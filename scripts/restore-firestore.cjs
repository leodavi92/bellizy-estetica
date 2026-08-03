/**
 * ==========================================================
 *  MUSAAGENDA — RESTAURAÇÃO MANUAL DE BACKUP
 * ==========================================================
 *
 * ⚠️  CUIDADO EXTREMO! RESTAURAÇÃO É UMA OPERAÇÃO DESTRUTIVA
 * ⚠️  POR PADRÃO SOBRESCREVE DOCUMENTOS EXISTENTES MESMO NOME.
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\service-account-key.json"
 *   npm run restore:firestore -- backups/firestore/SEU_ARQUIVO.json
 *
 * Flags opcionais:
 *   --dry-run           : não escreve nada, só valida estrutura e calcula totals.
 *   --only COLECAO      : restaura APENAS a coleção informada. Ex: --only users
 *   --exclude COLECAO   : pula a coleção informada. Ex: --exclude notifications
 *   --batch-size N      : quantos docs por batch write (default 250).
 *
 * Formato compatível:
 *   Arquivo gerado por scripts/backup-firestore.js (v1.0+).
 */

const fs = require('fs');
const path = require('path');

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('[restore] ❌ firebase-admin não encontrado. Rode: npm install firebase-admin@^13');
  process.exit(1);
}

try {
  if (admin.apps.length === 0) admin.initializeApp();
} catch (e) {
  console.error(
    '[restore] ❌ Autenticação falhou.\n' +
    '       Defina GOOGLE_APPLICATION_CREDENTIALS com a service account.\n' +
    '       Erro: ' + e.message
  );
  process.exit(2);
}

const db = admin.firestore();

// ----- Argument parsing -----------------------------------------------------
const argv = process.argv.slice(2);
const findFlag = (name) => {
  const i = argv.indexOf('--' + name);
  if (i === -1) return null;
  return argv[i + 1] ?? true;
};
const dryRun = findFlag('dry-run') !== null;
const only = findFlag('only');
const exclude = findFlag('exclude');
const batchSize = Number(findFlag('batch-size')) || 250;

const fileArg = argv.find((a) => !a.startsWith('--'));
if (!fileArg) {
  console.error(
    '\n[restore] ❌ Arquivo de backup não informado.\n\n' +
    '   Exemplo:\n' +
    '     npm run restore:firestore -- backups/firestore/2026-08-03_15-30-00.json\n'
  );
  process.exit(3);
}
const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`[restore] ❌ Arquivo não encontrado: ${filePath}`);
  process.exit(4);
}

// ----- Deserialização -------------------------------------------------------
const toFirestoreValue = (value) => {
  if (value && typeof value === 'object' && value.__type === 'Timestamp') {
    return new admin.firestore.Timestamp(value._seconds || 0, value._nanoseconds || 0);
  }
  if (value && typeof value === 'object' && value.__type === 'DocumentReference') {
    return db.doc(value.path);
  }
  if (value && typeof value === 'object' && value.__type === 'GeoPoint') {
    return new admin.firestore.GeoPoint(value.latitude, value.longitude);
  }
  if (value && typeof value === 'object' && value.__type === 'Bytes') {
    return Buffer.from(value.base64, 'base64');
  }
  if (Array.isArray(value)) return value.map(toFirestoreValue);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = toFirestoreValue(value[k]);
    return out;
  }
  return value;
};

// ----- Main -----------------------------------------------------------------
const main = async () => {
  const startedAt = Date.now();
  console.log('\n[restore] ====================================================');
  console.log('[restore] ♻️  Musa Agenda — Restaurar Backup');
  console.log('[restore] ====================================================\n');

  const projectId = admin.app().options.projectId || 'unknown-project';
  console.log(`[restore] 🪪 Projeto Firestore atual: ${projectId}`);
  console.log(`[restore] 📂 Arquivo de backup: ${path.relative(process.cwd(), filePath)}`);

  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error('[restore] ❌ Arquivo corrompido ou não é JSON válido. Erro: ' + e.message);
    process.exit(5);
  }

  if (!backup || !backup.__musa_backup || !backup.collections) {
    console.error('[restore] ❌ Arquivo não é um backup válido do Musa Agenda.');
    process.exit(6);
  }

  const meta = backup.__musa_backup;
  console.log(`[restore] 📋 Backup versão ${meta.version} · ${meta.exported_at_iso}`);
  console.log(`[restore] 📋 Projeto origem: ${meta.project_id} · Total de docs: ${meta.total_documents}\n`);

  if (meta.project_id !== projectId) {
    console.log(
      '[restore] ⚠️  Aviso: projeto origem (' + meta.project_id + ') ' +
      'diferente do destino (' + projectId + ').\n' +
      '           Está restaurando no banco correto? (Ctrl+C em 5s para cancelar)\n'
    );
    await new Promise((r) => setTimeout(r, 5000));
  }

  const colNames = Object.keys(backup.collections)
    .filter((c) => (only ? c === only : true))
    .filter((c) => (exclude ? c !== exclude : true));

  if (colNames.length === 0) {
    console.error('[restore] ❌ Nenhuma coleção a restaurar (only/exclude removaram tudo).');
    process.exit(7);
  }

  const stats = { restored: 0, skipped: 0, errors: 0 };

  for (const colName of colNames) {
    const docs = backup.collections[colName];
    console.log(`[restore] 📦 Coleção "${colName}" — ${docs.length} documento(s)`);

    if (dryRun) {
      stats.restored += docs.length;
      continue;
    }

    let batch = db.batch();
    let batchCount = 0;
    let committed = 0;

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const ref = db.doc(doc.__path);
      try {
        batch.set(ref, toFirestoreValue(doc.data), { merge: false });
        batchCount++;
      } catch (e) {
        console.error(`[restore]   ❌ erro ao preparar doc ${colName}/${doc.__id}: ${e.message}`);
        stats.errors++;
      }
      if (batchCount >= batchSize) {
        await batch.commit();
        committed += batchCount;
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
      committed += batchCount;
    }
    stats.restored += committed;
    console.log(`           → restaurados ${committed}`);
  }

  const s = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[restore] ✅ ${dryRun ? '(DRY-RUN) simulado' : 'concluído'} em ${s}s`);
  console.log(`           restaurados: ${stats.restored} · erros: ${stats.errors}`);
  console.log('');
};

main().catch((e) => {
  console.error('\n[restore] ❌ Falha:', e.message, '\n');
  console.error(e.stack);
  process.exit(9);
});
