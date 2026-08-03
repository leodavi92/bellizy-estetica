/**
 * ==========================================================
 *  MUSAAGENDA — BACKUP MANUAL DO FIRESTORE
 * ==========================================================
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\service-account-key.json"
 *   npm run backup:firestore
 *
 * Saída:
 *   ./backups/firestore/YYYY-MM-DD_HH-mm-ss.json
 *
 * NÃO MODIFIQUE ESTE SCRIPT SEM TESTAR ANTES EM UM PROJETO DEV.
 * Script usa Firebase Admin SDK oficial (100% seguro).
 *
 * Como obter service-account-key.json:
 *   1. Console Firebase → Configurações do Projeto → Contas de serviço
 *   2. "SDK Admin do Firebase" → Gerar nova chave privada
 *   3. Salve o arquivo em um local FORA do repositório.
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_VERSION = '1.0-musa-manual';
const BATCH_SIZE = 500;

// ----- Inicializa Admin SDK ------------------------------------------------
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error(
    '[backup] ❌ firebase-admin não encontrado.\n' +
    '       Rode: npm install --save-dev firebase-admin@^13'
  );
  process.exit(1);
}

try {
  if (admin.apps.length === 0) {
    admin.initializeApp();
    console.log('[backup] 🔑 Admin SDK inicializado com GOOGLE_APPLICATION_CREDENTIALS');
  }
} catch (e) {
  console.error(
    '[backup] ❌ Não foi possível autenticar no Admin SDK.\n' +
    '       Defina a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando\n' +
    '       para o service-account-key.json do projeto estetica-f543c.\n' +
    '       Exemplo PowerShell:\n' +
    '         $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\keys\\musa-service-account.json"\n\n' +
    '       Erro original:', e.message
  );
  process.exit(2);
}

const db = admin.firestore();

// ----- Helpers --------------------------------------------------------------
const ts = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

const serializableValue = (value) => {
  // Timestamp Admin → formato ISO + __type para restaurar
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return { __type: 'Timestamp', _seconds: value.seconds, _nanoseconds: value.nanoseconds };
  }
  // DocumentReference guardamos path
  if (value && typeof value === 'object' && typeof value.path === 'string') {
    return { __type: 'DocumentReference', path: value.path };
  }
  // GeoPoint
  if (value && typeof value === 'object' && '_latitude' in value && '_longitude' in value) {
    return { __type: 'GeoPoint', latitude: value._latitude, longitude: value._longitude };
  }
  // Buffer / ArrayBuffer / TypedArray → base64
  if (value instanceof Uint8Array) {
    return { __type: 'Bytes', base64: Buffer.from(value).toString('base64') };
  }
  // Array
  if (Array.isArray(value)) {
    return value.map(serializableValue);
  }
  // Objeto aninhado
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = serializableValue(value[k]);
    return out;
  }
  return value;
};

const exportCollection = async (collectionRef) => {
  const docs = [];
  let cursor = null;
  while (true) {
    let q = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      docs.push({
        __id: doc.id,
        __path: doc.ref.path,
        data: serializableValue(doc.data()),
      });
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }
  return docs;
};

// ----- Main -----------------------------------------------------------------
const main = async () => {
  const startedAt = Date.now();
  console.log('\n[backup] ====================================================');
  console.log('[backup] 📦 Musa Agenda — Backup Manual do Firestore');
  console.log('[backup] ====================================================\n');

  const projectId = admin.app().options.projectId || 'unknown-project';
  console.log(`[backup] 🪪 Projeto Firestore detectado: ${projectId}`);

  const root = db;
  const rootCollections = await root.listCollections();
  console.log(`[backup] 📁 ${rootCollections.length} coleção(ões) no nível raiz\n`);

  const collections = {};
  let totalDocs = 0;

  for (const colRef of rootCollections) {
    const name = colRef.id;
    process.stdout.write(`[backup] Exportando ${name} … `);
    const docs = await exportCollection(colRef);
    collections[name] = docs;
    totalDocs += docs.length;
    console.log(`✅ ${docs.length} doc(s)`);
  }

  const payload = {
    __musa_backup: {
      version: SCRIPT_VERSION,
      project_id: projectId,
      exported_at_iso: new Date().toISOString(),
      total_documents: totalDocs,
      collection_count: rootCollections.length,
      counts: Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])),
    },
    collections,
  };

  const outDir = path.resolve(process.cwd(), 'backups', 'firestore');
  fs.mkdirSync(outDir, { recursive: true });

  const fileName = `${ts()}.json`;
  const fullPath = path.join(outDir, fileName);
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf-8');

  const sizeKB = (fs.statSync(fullPath).size / 1024).toFixed(2);
  const durationS = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n[backup] ✅ Concluído em ${durationS}s — ${totalDocs} documento(s)`);
  console.log(`[backup] 💾 Arquivo salvo em:`);
  console.log(`            ${fullPath}`);
  console.log(`[backup] 📊 Tamanho do JSON: ${sizeKB} KB`);
  console.log('\n[backup] 💡 Dica: guarde uma cópia em local seguro (OneDrive privado,' +
              '\n         Google Drive criptografado, HD externo, etc.).');
  console.log('');
};

main().catch((e) => {
  console.error('\n[backup] ❌ Falha:', e.message, '\n');
  console.error(e.stack);
  process.exit(3);
});
