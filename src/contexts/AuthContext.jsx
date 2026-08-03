import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
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
import { doc, getDoc, setDoc, collection, addDoc, Timestamp, onSnapshot, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { buildEstablishmentPayload, normalizeEstablishmentData, generateUniqueSlug } from '../services/establishmentService';
import { completeProfessionalFirstAccess } from '../services/teamService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper para verificar se um e-mail pertence a um profissional convidado
  const checkProfessionalInvite = useCallback(async (email) => {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    console.log("Verificando convite para:", cleanEmail);
    
    try {
      // Tenta buscar pelo campo 'email'
      const q = query(collection(db, "professionals"), where("email", "==", cleanEmail));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const profDoc = querySnapshot.docs[0];
        console.log("Convite encontrado (email):", profDoc.id, profDoc.data());
        return { id: profDoc.id, ...profDoc.data() };
      }

      // Fallback para e-mail com hífen (legado)
      const qLegacy = query(collection(db, "professionals"), where("e-mail", "==", cleanEmail));
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
        let establishmentId = null;
        let finalRole = role;
        let professionalId = null;

        const professionalData = await checkProfessionalInvite(result.user.email);

        if (professionalData) {
          finalRole = 'staff';
          establishmentId = professionalData.establishment_id;
          professionalId = professionalData.id;
        } else if (role === 'admin') {
          const uniqueSlug = await generateUniqueSlug(`estetica-${result.user.uid.slice(0, 6)}`);
          const estRef = await addDoc(
            collection(db, 'establishments'),
            buildEstablishmentPayload(result.user.uid, {
              nome: '',
              slug: uniqueSlug,
              logo_url: result.user.photoURL || '',
              subscription: {
                status: 'trial',
                trial_ends_at: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
                plan: 'silver'
              },
              setup_steps: {
                info_basica: false,
                logo: !!result.user.photoURL,
                schedule: false,
                first_service: false,
                policy: false
              },
              profile_completed: false,
              createdAt: Timestamp.now()
            })
          );
          establishmentId = estRef.id;
        }

        const userData = {
          nome: result.user.displayName,
          email: result.user.email,
          tipo: finalRole,
          establishment_id: establishmentId,
          professional_id: professionalId,
          telefone: '',
          photoURL: result.user.photoURL,
          createdAt: new Date().toISOString(),
          last_write_ts: Timestamp.now(),
          aceitou_lgpd_em: new Date().toISOString(),
          aceitou_lgpd_version: 1,
        };
        
        await setDoc(userRef, userData);
        const finalUser = { uid: result.user.uid, ...userData };
        setUser(finalUser);
        return finalUser;
      } else {
        const data = userSnap.data();
        if (role === 'admin' && data.tipo === 'cliente' && !data.establishment_id) {
          const uniqueSlug = await generateUniqueSlug(`estetica-${result.user.uid.slice(0, 6)}`);
          const estRef = await addDoc(
            collection(db, 'establishments'),
            buildEstablishmentPayload(result.user.uid, {
              nome: '',
              slug: uniqueSlug,
              logo_url: result.user.photoURL || '',
              subscription: {
                status: 'trial',
                trial_ends_at: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
                plan: 'silver'
              },
              setup_steps: {
                info_basica: false,
                logo: !!result.user.photoURL,
                schedule: false,
                first_service: false,
                policy: false
              },
              profile_completed: false,
              createdAt: Timestamp.now()
            })
          );
          
          const updateData = {
            tipo: 'admin',
            establishment_id: estRef.id,
            last_write_ts: Timestamp.now()
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
  }, [checkProfessionalInvite]);

  const signUpWithEmail = useCallback(async (email, password, nome, role = 'cliente', extraData = {}) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: nome });
      
      let establishmentId = null;
      let finalRole = role;
      let professionalId = null;

      const professionalData = await checkProfessionalInvite(email);
      
      if (professionalData) {
        finalRole = 'staff';
        establishmentId = professionalData.establishment_id;
        professionalId = professionalData.id;
      } else if (role === 'admin') {
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
            subscription: {
              status: 'trial',
              trial_ends_at: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
              plan: 'silver'
            },
            setup_steps: {
              info_basica: !!(businessName && extraData.telefone),
              logo: false,
              schedule: false,
              first_service: false,
              policy: false
            },
            profile_completed: false,
            createdAt: Timestamp.now()
          })
        );
        establishmentId = estRef.id;
      }

      const userData = {
        nome,
        email,
        tipo: finalRole,
        establishment_id: establishmentId,
        professional_id: professionalId,
        createdAt: new Date().toISOString(),
        last_write_ts: Timestamp.now(),
        aceitou_lgpd_em: new Date().toISOString(),
        aceitou_lgpd_version: 1,
        ...extraData
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userData);
      setUser({ uid: result.user.uid, ...userData });
      
      return result.user;
    } catch (error) {
      console.error("Erro detalhado no cadastro:", error);
      throw error;
    }
  }, [checkProfessionalInvite]);

  const signInWithEmail = useCallback(async (email, password, role = 'cliente') => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Lógica de Upgrade Automático se ele logar como Admin sendo Cliente
      if (role === 'admin') {
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          
          // Se ele é cliente e não tem estabelecimento, faz o upgrade
          if (data.tipo === 'cliente' && !data.establishment_id) {
            const uniqueSlug = await generateUniqueSlug(`estetica-${result.user.uid.slice(0, 6)}`);
            const estRef = await addDoc(
              collection(db, 'establishments'),
              buildEstablishmentPayload(result.user.uid, {
                nome: '',
                slug: uniqueSlug,
                subscription: {
                  status: 'trial',
                  trial_ends_at: Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
                  plan: 'silver'
                },
                setup_steps: {
                  info_basica: false,
                  logo: false,
                  schedule: false,
                  first_service: false,
                  policy: false
                },
                profile_completed: false,
                createdAt: Timestamp.now()
              })
            );
            
            const updateData = {
              tipo: 'admin',
              establishment_id: estRef.id
            };
            
            await updateDoc(userRef, updateData);
            setUser({ uid: result.user.uid, ...data, ...updateData });
          }
        }
      }
      
      return result.user;
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      throw error;
    }
  }, []);

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

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUser({ uid: firebaseUser.uid, ...data });
          } else {
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
    changePassword
  }), [user, establishment, loading, loginWithGoogle, signUpWithEmail, signInWithEmail, logout, updateUserPassword, resetPassword, changePassword]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
