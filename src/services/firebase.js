import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const overrides = (typeof window !== 'undefined' && window.FIREBASE_CONFIG_OVERRIDE) || {};

const getVar = (key) => {
  const v = overrides[key] != null ? overrides[key] : env[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.startsWith('SUA_') || t.startsWith('SEU_')) return null;
  return t;
};

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingKeys = REQUIRED_KEYS.filter(k => !getVar(k));

const firebaseConfig = {
  apiKey:            getVar('VITE_FIREBASE_API_KEY')            || 'placeholder-missing-vite-firebase-api-key',
  authDomain:        getVar('VITE_FIREBASE_AUTH_DOMAIN')        || 'missing.firebaseapp.com',
  projectId:         getVar('VITE_FIREBASE_PROJECT_ID')         || 'missing-project-id',
  storageBucket:     getVar('VITE_FIREBASE_STORAGE_BUCKET')     || 'missing-project-id.appspot.com',
  messagingSenderId: getVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '000000000000',
  appId:             getVar('VITE_FIREBASE_APP_ID')             || '1:000000000000:web:missing',
};

export const firebaseBootstrapHealthy = missingKeys.length === 0;
export const firebaseBootstrapMissingKeys = missingKeys.slice();
export const firebaseBootstrapWarnings = [];

let app = null;
try {
  app = initializeApp(firebaseConfig);
} catch (err) {
  const msg = err && err.message ? err.message : String(err || 'Erro Firebase desconhecido');
  firebaseBootstrapWarnings.push(msg);
  console.error('[firebase.js] Falha ao inicializar Firebase com vars incompletas:', msg);
  try {
    app = initializeApp({
      apiKey: 'placeholder-failsafe-mode',
      authDomain: 'failsafe.local',
      projectId: 'musa-agenda-failsafe',
      storageBucket: 'musa-agenda-failsafe.appspot.com',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:failsafe',
    }, 'musa-agenda-failsafe');
  } catch (_e2) {
    app = null;
  }
}

export const authFailsafe = {
  healthy: false,
  missingKeys,
  errors: firebaseBootstrapWarnings,
  isMissing: missingKeys.length > 0,
};

let auth = null;
try {
  if (app) {
    auth = getAuth(app);
    authFailsafe.healthy = true;
  }
} catch (err) {
  firebaseBootstrapWarnings.push('auth-init: ' + (err && err.message ? err.message : String(err || 'erro auth')));
  console.warn('[firebase.js] auth não pôde ser inicializado — modo failsafe.');
}
export { auth };

let storage = null;
try {
  if (app) storage = getStorage(app);
} catch (_e) { storage = null; }
export { storage };

const FUNCTIONS_REGION = getVar('VITE_FUNCTIONS_REGION') || "southamerica-east1";
let functions = null;
try {
  if (app) functions = getFunctions(app, FUNCTIONS_REGION);
} catch (_e) { functions = null; }
export { functions };

export function callFunction(name, data = {}) {
  if (!functions) {
    return Promise.reject(new Error(
      'Não foi possível conectar às funções do backend. Verifique as variáveis VITE_FIREBASE_* no arquivo `.env.local`.'
    ));
  }
  return httpsCallable(functions, name)(data);
}

let db = null;
try {
  if (app) {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  }
} catch (err) {
  console.warn('[firebase.js] initializeFirestore falhou:', err && err.message ? err.message : err);
  db = null;
}
export { db };

export const googleProvider = new GoogleAuthProvider();

let messaging = null;
try {
  const vapid = getVar('VITE_FIREBASE_VAPID_KEY');
  if (app && vapid && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    isMessagingSupported().then(ok => {
      if (ok) {
        try { messaging = getMessaging(app); } catch (_e) { /* noop */ }
      }
    }).catch(() => {});
  }
} catch (_e) { /* noop */ }
export { messaging };

export function userDoc(uid) {
  return doc(db, 'users', uid);
}

export async function updateUserDoc(uid, payload = {}) {
  return updateDoc(doc(db, 'users', uid), {
    ...payload,
    last_write_ts: Timestamp.now(),
  });
}

export async function setUserDoc(uid, payload = {}) {
  return setDoc(doc(db, 'users', uid), {
    ...payload,
    last_write_ts: Timestamp.now(),
  });
}

export async function updateUserDocRef(ref, payload = {}) {
  return updateDoc(ref, {
    ...payload,
    last_write_ts: Timestamp.now(),
  });
}
