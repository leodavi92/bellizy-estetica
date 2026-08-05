import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  auth,
  db,
  googleProvider,
  firebaseBootstrapMissingKeys,
  firebaseBootstrapHealthy,
  authFailsafe
} from '../services/firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, Timestamp, onSnapshot, updateDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { buildEstablishmentPayload, normalizeEstablishmentData, generateUniqueSlug } from '../services/establishmentService';
import { completeProfessionalFirstAccess } from '../services/teamService';
import { AlertTriangle, Download, Copy, CheckCircle2 } from 'lucide-react';

const AuthContext = createContext();

function FirebaseConfigMissingScreen() {
  const missing = firebaseBootstrapMissingKeys || [];
  const [copied, setCopied] = useState(false);
  const copyModelo = async () => {
    const modelo = `# ====== Cole ESTES valores no arquivo .env.local na RAIZ do projeto ======
# Console Firebase → ⚙️ Configurações do projeto → Geral → Seus apps → App Web → firebaseConfig
VITE_FIREBASE_API_KEY=COLE_AQUI
VITE_FIREBASE_AUTH_DOMAIN=COLE_AQUI
VITE_FIREBASE_PROJECT_ID=COLE_AQUI
VITE_FIREBASE_STORAGE_BUCKET=COLE_AQUI
VITE_FIREBASE_MESSAGING_SENDER_ID=COLE_AQUI
VITE_FIREBASE_APP_ID=COLE_AQUI

# (Opcional) FCM Push
VITE_FIREBASE_VAPID_KEY=

# Functions região
VITE_FUNCTIONS_REGION=southamerica-east1

# Mercado Pago
VITE_MERCADO_PAGO_PUBLIC_KEY=
VITE_SUBSCRIPTION_API_URL=
`;
    try {
      await navigator.clipboard.writeText(modelo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      alert('Copie manualmente:\n\n' + modelo);
    }
  };
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 px-4 py-10">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl shadow-pink-100/60 ring-1 ring-pink-100 border border-pink-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-6 py-5 flex items-center gap-3">
          <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <AlertTriangle size={22} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-lg sm:text-xl leading-tight">
              Configuração necessária antes de usar o Musa Agenda
            </p>
            <p className="text-xs sm:text-sm font-bold text-white/85 leading-relaxed mt-0.5">
              Firebase está sem as chaves de API. O login e o banco de dados não funcionam sem elas.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-5 text-slate-700">
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-amber-800 mb-2">
              Passo a passo (3 minutos)
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm font-semibold text-amber-900/90 leading-relaxed">
              <li>Abra <strong>console.firebase.google.com</strong> e entre no projeto.</li>
              <li>No menu <strong>⚙️ Configurações do projeto → Geral</strong>, role até <strong>Seus apps</strong> e clique no app Web <code className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[11px] font-black tracking-wider text-amber-900">&lt;/&gt;</code>.</li>
              <li>Copie os 6 valores de <code className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[11px] font-black text-amber-900">firebaseConfig</code> (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).</li>
              <li>Cole esses 6 valores no arquivo <code className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[11px] font-black tracking-wider text-amber-900">.env.local</code> na PASTA RAIZ do projeto.</li>
              <li>Reinicie o servidor de desenvolvimento: <code className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[11px] font-black text-amber-900">npm run dev</code>.</li>
            </ol>
          </div>

          <div>
            <p className="text-sm font-black text-slate-900 mb-2 flex items-center gap-2">
              <span className="text-rose-500">✕</span> Variáveis ausentes detectadas:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {missing.map(k => (
                <div key={k} className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center leading-none">!</span>
                  <code className="text-[11px] sm:text-xs font-mono font-black text-rose-800 truncate">{k}</code>
                </div>
              ))}
            </div>
            {authFailsafe?.errors?.length > 0 && (
              <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Detalhes técnicos do erro Firebase:</p>
                {authFailsafe.errors.map((e, i) => (
                  <pre key={i} className="whitespace-pre-wrap break-words font-mono text-[11px] text-rose-700 leading-relaxed">{e}</pre>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <button
              onClick={copyModelo}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 text-white px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? 'Modelo copiado!' : 'Copiar modelo .env.local'}
            </button>
            <a
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Abrir Console Firebase
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Evita race entre onAuthStateChanged e loginWithGoogle/signUp durante criação do perfil */
  const profileBootstrapRef = useRef(null);

  const createAdminEstablishment = useCallback(async (adminUid, options = {}) => {
    const uniqueSlug = await generateUniqueSlug(
      options.slugBase || `estetica-${adminUid.slice(0, 6)}`
    );
    const estRef = await addDoc(
      collection(db, 'establishments'),
      buildEstablishmentPayload(adminUid, {
        nome: options.nome || '',
        slug: uniqueSlug,
        telefone: options.telefone || '',
        endereco: options.endereco || '',
        logo_url: options.photoURL || '',
        subscription: {
          status: 'trial',
          trial_ends_at: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
          plan: 'silver'
        },
        setup_steps: {
          info_basica: !!(options.nome && options.telefone),
          logo: !!options.photoURL,
          schedule: false,
          first_service: false,
          policy: false
        },
        profile_completed: false,
        createdAt: Timestamp.now()
      })
    );
    return estRef.id;
  }, []);

  // Helper para verificar se um e-mail pertence a um profissional convidado
  const checkProfessionalInvite = useCallback(async (email) => {
    if (!email) return null;
    if (!db) return null; // failsafe Firebase não inicializado (ainda na tela de setup)
    const cleanEmail = email.trim().toLowerCase();
    console.log("Verificando convite para:", cleanEmail);
    
    try {
      // Tenta buscar pelo campo 'email'
      const q = query(
        collection(db, "professionals"),
        where("email", "==", cleanEmail),
        limit(2)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const profDoc = querySnapshot.docs[0];
        console.log("Convite encontrado (email):", profDoc.id, profDoc.data());
        return { id: profDoc.id, ...profDoc.data() };
      }

      // Fallback para e-mail com hífen (legado)
      const qLegacy = query(
        collection(db, "professionals"),
        where("e-mail", "==", cleanEmail),
        limit(2)
      );
      const querySnapshotLegacy = await getDocs(qLegacy);
      if (!querySnapshotLegacy.empty) {
        const profDoc = querySnapshotLegacy.docs[0];
        console.log("Convite encontrado (e-mail):", profDoc.id, profDoc.data());
        return { id: profDoc.id, ...profDoc.data() };
      }

      console.log("Nenhum convite encontrado para:", cleanEmail);
      return null;
    } catch (error) {
      console.error("Erro ao verificar convite de profissional:", error);
      return null;
    }
  }, []);

  /**
   * Bootstrap de perfil para usuário recém-autenticado sem documento em users/{uid}.
   * Ordem garantida:
   *   1. Verifica convite de profissional (Rules permitem leitura pelo e-mail autenticado)
   *   2. Cria estabelecimento se admin
   *   3. Cria users/{uid} já com papel e vínculos finais (sem update de promoção)
   */
  const bootstrapNewUserProfile = useCallback(async (firebaseUser, role = 'cliente', options = {}) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const displayName = options.nome || firebaseUser.displayName || '';
    const email = firebaseUser.email || options.email || '';

    let finalRole = role;
    let establishmentId = null;
    let professionalId = null;

    const professionalData = await checkProfessionalInvite(email);

    if (professionalData) {
      finalRole = 'staff';
      establishmentId = professionalData.establishment_id;
      professionalId = professionalData.id;
    } else if (role === 'admin') {
      establishmentId = await createAdminEstablishment(firebaseUser.uid, {
        nome: options.nomeEstetica || displayName,
        telefone: options.telefone || '',
        endereco: options.endereco || '',
        photoURL: firebaseUser.photoURL || '',
        slugBase: options.nomeEstetica
          ? undefined
          : `estetica-${firebaseUser.uid.slice(0, 6)}`
      });
      finalRole = 'admin';
    } else {
      finalRole = 'cliente';
    }

    const userData = {
      nome: displayName,
      email,
      tipo: finalRole,
      establishment_id: establishmentId,
      professional_id: professionalId,
      telefone: options.telefone || '',
      photoURL: firebaseUser.photoURL || options.photoURL || '',
      createdAt: new Date().toISOString(),
      last_write_ts: Timestamp.now(),
      aceitou_lgpd_em: new Date().toISOString(),
      aceitou_lgpd_version: 1,
    };

    await setDoc(userRef, userData);
    return { uid: firebaseUser.uid, ...userData };
  }, [checkProfessionalInvite, createAdminEstablishment]);

  const upgradeClienteToAdmin = useCallback(async (firebaseUser, existingData) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const establishmentId = await createAdminEstablishment(firebaseUser.uid, {
      photoURL: firebaseUser.photoURL || existingData.photoURL || '',
      slugBase: `estetica-${firebaseUser.uid.slice(0, 6)}`
    });

    const updateData = {
      tipo: 'admin',
      establishment_id: establishmentId,
      last_write_ts: Timestamp.now()
    };

    await updateDoc(userRef, updateData);
    return { uid: firebaseUser.uid, ...existingData, ...updateData };
  }, [createAdminEstablishment]);

  // Escuta em tempo real para o estabelecimento sempre que o usuário mudar
  useEffect(() => {
    let unsubscribeEst = () => {};

    if (user?.establishment_id) {
      unsubscribeEst = onSnapshot(doc(db, 'establishments', user.establishment_id), (snap) => {
        if (snap.exists()) {
          setEstablishment(normalizeEstablishmentData({ id: snap.id, ...snap.data() }));
        }
      }, (error) => {
        console.error("Erro na escuta do estabelecimento:", error);
      });
    } else {
      setEstablishment(null);
    }

    return () => unsubscribeEst();
  }, [user?.establishment_id]);

  const loginWithGoogle = useCallback(async (role = 'cliente') => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const bootstrapPromise = bootstrapNewUserProfile(result.user, role);
        profileBootstrapRef.current = bootstrapPromise;
        try {
          const finalUser = await bootstrapPromise;
          setUser(finalUser);
          return finalUser;
        } finally {
          profileBootstrapRef.current = null;
        }
      }

      const data = userSnap.data();
      if (role === 'admin' && data.tipo === 'cliente' && !data.establishment_id) {
        const finalUser = await upgradeClienteToAdmin(result.user, data);
        setUser(finalUser);
        return finalUser;
      }

      const finalUser = { uid: result.user.uid, ...data };
      setUser(finalUser);
      return finalUser;
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      throw error;
    }
  }, [bootstrapNewUserProfile, upgradeClienteToAdmin]);

  const signUpWithEmail = useCallback(async (email, password, nome, role = 'cliente', extraData = {}) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: nome });

      const bootstrapPromise = bootstrapNewUserProfile(result.user, role, {
        nome,
        email,
        telefone: extraData?.telefone || '',
        nomeEstetica: extraData.nomeEstetica || (role === 'admin' ? nome : ''),
        endereco: extraData.endereco || ''
      });
      profileBootstrapRef.current = bootstrapPromise;
      try {
        const finalUser = await bootstrapPromise;
        setUser(finalUser);
        return result.user;
      } finally {
        profileBootstrapRef.current = null;
      }
    } catch (error) {
      console.error("Erro detalhado no cadastro:", error);
      throw error;
    }
  }, [bootstrapNewUserProfile]);

  const signInWithEmail = useCallback(async (email, password, role = 'cliente') => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      if (role === 'admin') {
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();

          if (data.tipo === 'cliente' && !data.establishment_id) {
            const finalUser = await upgradeClienteToAdmin(result.user, data);
            setUser(finalUser);
          }
        }
      }

      return result.user;
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      throw error;
    }
  }, [upgradeClienteToAdmin]);

  const resetPassword = useCallback((email) => {
    return sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const updateUserPassword = useCallback(async (newPassword, currentPassword) => {
    if (!auth.currentUser) throw new Error("Usuário não autenticado");
    
    // Se fornecer a senha atual, tenta reautenticar antes de trocar
    if (currentPassword) {
      const credentials = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credentials);
    }
    
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          let userSnap;

          try {
            userSnap = await getDoc(userRef);
          } catch (error) {
            console.warn("Erro ao buscar documento do usuário (possivelmente offline):", error);
            setUser({
              uid: firebaseUser.uid,
              nome: firebaseUser.displayName,
              email: firebaseUser.email,
              tipo: 'cliente',
              photoURL: firebaseUser.photoURL,
              isOffline: true
            });
            setLoading(false);
            return;
          }

          if (!userSnap.exists() && profileBootstrapRef.current) {
            try {
              await profileBootstrapRef.current;
              userSnap = await getDoc(userRef);
            } catch (bootstrapErr) {
              console.error("Erro aguardando bootstrap de perfil:", bootstrapErr);
            }
          }

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUser({ uid: firebaseUser.uid, ...data });
          } else {
            setUser({
              uid: firebaseUser.uid,
              nome: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              tipo: 'cliente',
              photoURL: firebaseUser.photoURL || '',
              _profilePending: true
            });
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Erro no onAuthStateChanged:", error);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const changePassword = useCallback(async (newPassword) => {
    if (!auth.currentUser) throw new Error("Usuário não autenticado");
    
    // Importante: para trocar senha, o Firebase exige reautenticação se o login for antigo.
    // Como aqui é o primeiro acesso, o login é recente, então deve funcionar direto.
    await updatePassword(auth.currentUser, newPassword);
    
    // Se for staff, precisamos atualizar o Firestore também
    if (user?.tipo === 'staff' && user?.professional_id) {
      await completeProfessionalFirstAccess(user.uid, user.professional_id, newPassword);
      
      // Atualiza o estado local do usuário
      setUser(prev => ({ ...prev, requirePasswordChange: false }));
    } else {
      // Para outros tipos de usuários, apenas remove a flag se existir
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { requirePasswordChange: false });
      setUser(prev => ({ ...prev, requirePasswordChange: false }));
    }
  }, [user]);

  const value = useMemo(() => ({
    user,
    setUser,
    establishment,
    loading,
    loginWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    logout,
    updateUserPassword,
    resetPassword,
    changePassword,
    firebaseBootstrapMissingKeys,
    firebaseBootstrapHealthy,
    authFailsafe
  }), [user, establishment, loading, loginWithGoogle, signUpWithEmail, signInWithEmail, logout, updateUserPassword, resetPassword, changePassword]);

  if (!firebaseBootstrapHealthy) {
    return <FirebaseConfigMissingScreen />;
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
