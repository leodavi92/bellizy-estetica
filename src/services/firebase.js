import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, updateDoc, setDoc, Timestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";

// Configurações do Firebase usando variáveis de ambiente do Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Cloud Functions: sa-east1 (configuração do projeto backend)
const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION || "southamerica-east1";
export const functions = getFunctions(app, FUNCTIONS_REGION);
export function callFunction(name, data = {}) {
  return httpsCallable(functions, name)(data);
}

// Inicializa o Firestore com persistência de dados local habilitada
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const googleProvider = new GoogleAuthProvider();

/**
 * Helpers para escrita em `/users/{uid}` que garantem a atualização automática
 * do campo `last_write_ts` (utilizado pelo rate-limiting Server-Side nas rules).
 *
 * Regras que usam `hasRateLimit()` checam `users.uid.last_write_ts`.
 */
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
