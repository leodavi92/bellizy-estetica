import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, Timestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { buildEstablishmentPayload, normalizeEstablishmentData, generateUniqueSlug } from '../services/establishmentService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Escuta em tempo real para o estabelecimento sempre que o usuário mudar
  useEffect(() => {
    let unsubscribeEst = () => {};

    if (user?.establishment_id) {
      unsubscribeEst = onSnapshot(doc(db, 'establishments', user.establishment_id), (snap) => {
        if (snap.exists()) {
          setEstablishment(normalizeEstablishmentData({ id: snap.id, ...snap.data() }));
        }
      });
    } else {
      setEstablishment(null);
    }

    return () => unsubscribeEst();
  }, [user?.establishment_id]);

  async function loginWithGoogle(role = 'cliente') {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', result.user.uid);
      
      // Forçamos uma pequena espera para garantir que o onAuthStateChanged 
      // não atropele a criação do documento caso seja um novo usuário
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        let establishmentId = null;

        if (role === 'admin') {
          const uniqueSlug = await generateUniqueSlug(`estetica-${result.user.uid.slice(0, 6)}`);
          const estRef = await addDoc(
            collection(db, 'establishments'),
            buildEstablishmentPayload(result.user.uid, {
              nome: '',
              slug: uniqueSlug,
              logo_url: result.user.photoURL || '',
              setup_steps: {
                info_basica: false,
                logo: !!result.user.photoURL,
                schedule: false,
                first_service: false,
                policy: false
              },
              createdAt: Timestamp.now()
            })
          );
          establishmentId = estRef.id;
        }

        const userData = {
          nome: result.user.displayName,
          email: result.user.email,
          tipo: role,
          establishment_id: establishmentId,
          telefone: '',
          photoURL: result.user.photoURL,
          createdAt: new Date().toISOString()
        };
        
        await setDoc(userRef, userData);
        
        // Atualizamos o estado local imediatamente com o papel correto
        const finalUser = { uid: result.user.uid, ...userData };
        setUser(finalUser);
        return finalUser;
      } else {
        const data = userSnap.data();
        
        // Se o usuário já existe mas quer entrar como admin e ainda é cliente, 
        // podemos atualizar o papel dele se ele não tiver um estabelecimento.
        if (role === 'admin' && data.tipo === 'cliente' && !data.establishment_id) {
          const uniqueSlug = await generateUniqueSlug(`estetica-${result.user.uid.slice(0, 6)}`);
          const estRef = await addDoc(
            collection(db, 'establishments'),
            buildEstablishmentPayload(result.user.uid, {
              nome: '',
              slug: uniqueSlug,
              logo_url: result.user.photoURL || '',
              setup_steps: {
                info_basica: false,
                logo: !!result.user.photoURL,
                schedule: false,
                first_service: false,
                policy: false
              },
              createdAt: Timestamp.now()
            })
          );
          
          const updateData = {
            tipo: 'admin',
            establishment_id: estRef.id
          };
          
          await updateDoc(userRef, updateData);
          const finalUser = { uid: result.user.uid, ...data, ...updateData };
          setUser(finalUser);
          return finalUser;
        }

        const finalUser = { uid: result.user.uid, ...data };
        setUser(finalUser);
        return finalUser;
      }
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      throw error;
    }
  }

  async function signUpWithEmail(email, password, nome, role = 'cliente', extraData = {}) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: nome });
      
      let establishmentId = null;

      // Se for admin, cria o estabelecimento automaticamente com campos de onboarding
      if (role === 'admin') {
        const businessName = extraData.nomeEstetica || '';
        const uniqueSlug = await generateUniqueSlug(
          businessName ? businessName : `estetica-${result.user.uid.slice(0, 6)}`
        );
        const estRef = await addDoc(
          collection(db, 'establishments'),
          buildEstablishmentPayload(result.user.uid, {
            nome: businessName,
            slug: uniqueSlug,
            telefone: extraData.telefone || '',
            endereco: extraData.endereco || '',
            setup_steps: {
              info_basica: !!(businessName && extraData.telefone),
              logo: false,
              schedule: false,
              first_service: false,
              policy: false
            },
            createdAt: Timestamp.now()
          })
        );
        establishmentId = estRef.id;
      }

      const userData = {
        nome,
        email,
        tipo: role,
        establishment_id: establishmentId,
        createdAt: new Date().toISOString(),
        ...extraData
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userData);
      setUser({ uid: result.user.uid, ...userData });
      
      if (establishmentId) {
        // A escuta em tempo real no useEffect cuidará do setEstablishment
      }

      return result.user;
    } catch (error) {
      console.error("Erro detalhado no cadastro:", error);
      throw error;
    }
  }

  async function signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged cuidará de carregar os dados do Firestore
      return result.user;
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      throw error;
    }
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function logout() {
    return signOut(auth);
  }

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
            // Se falhar ao buscar do Firestore (ex: offline), usa dados básicos do Firebase Auth
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

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUser({ uid: firebaseUser.uid, ...data });
          } else {
            // Se o documento não existe, não definimos o usuário imediatamente 
            // para evitar que o tipo 'cliente' (padrão) atropele um cadastro de admin em curso.
            // O setUser será chamado pelas funções loginWithGoogle ou signUpWithEmail.
            console.log("Documento do usuário não encontrado no onAuthStateChanged. Aguardando criação...");
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

  return (
    <AuthContext.Provider value={{ user, setUser, establishment, loginWithGoogle, signUpWithEmail, signInWithEmail, resetPassword, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
