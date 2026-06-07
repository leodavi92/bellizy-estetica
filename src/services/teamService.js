import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, collection, query, where, getDocs, getDoc, Timestamp, updateDoc, deleteField } from "firebase/firestore";

// Configurações do Firebase (mesmas do seu app principal)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa ou recupera a instância secundária para não deslogar o Admin
const getSecondaryAuth = () => {
  const secondaryAppName = "SecondaryAuth";
  let secondaryApp;
  
  if (getApps().some(app => app.name === secondaryAppName)) {
    secondaryApp = getApp(secondaryAppName);
  } else {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }
  
  return getAuth(secondaryApp);
};

export const generateTemporaryPassword = (name) => {
  // Senha: Musa@ + primeira letra do nome + 3 números aleatórios
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `Musa@${name.charAt(0).toUpperCase()}${randomNum}`;
};

export const createManagedStaffAccount = async (memberData, establishment) => {
  const { nome, cargo, servicos, email: providedEmail } = memberData;
  const password = generateTemporaryPassword(nome);
  const email = providedEmail.toLowerCase().trim();
  
  const secondaryAuth = getSecondaryAuth();
  
  try {
    // 1. Cria a conta no Firebase Auth (instância secundária)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    
    // 2. Cria o documento na coleção 'professionals'
    const profRef = doc(collection(db, "professionals"));
    const professionalId = profRef.id;
    
    const professionalPayload = {
      id: professionalId,
      nome,
      cargo,
      email: email,
      password: password, // Armazena a senha provisória até o primeiro login
      servicos: servicos || [],
      establishment_id: establishment.id,
      auth_uid: uid,
      tipo: 'staff',
      active: true,
      requirePasswordChange: true, // Flag para troca obrigatória
      createdAt: Timestamp.now()
    };
    
    await setDoc(profRef, professionalPayload);
    
    // 3. Cria o documento na coleção 'users' para o AuthContext reconhecer
    const userPayload = {
      uid,
      nome,
      email: email,
      tipo: 'staff',
      establishment_id: establishment.id,
      professional_id: professionalId,
      active: true,
      requirePasswordChange: true, // Flag também aqui para facilitar no AuthContext
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, "users", uid), userPayload);
    
    // 4. Importante: Deslogar a conta secundária para não ficar lixo na memória
    await secondaryAuth.signOut();
    
    return { 
      success: true, 
      email, 
      password, 
      professionalId 
    };
  } catch (error) {
    console.error("Erro ao criar conta gerenciada:", error);
    // Se o erro for 'auth/email-already-in-use', tenta gerar um e-mail alternativo
    if (error.code === 'auth/email-already-in-use') {
      throw new Error("Este e-mail já está em uso por outro profissional.");
    }
    throw error;
  }
};

/**
 * Finaliza o processo de primeiro acesso do profissional
 */
export const completeProfessionalFirstAccess = async (uid, professionalId, newPassword) => {
  try {
    // 1. Atualiza a senha no Firebase Auth
    const currentUser = getAuth().currentUser;
    if (!currentUser || currentUser.uid !== uid) throw new Error("Usuário não autenticado corretamente");
    
    await updatePassword(currentUser, newPassword);

    // 2. Remove a senha em texto claro e a flag do documento do profissional
    const profRef = doc(db, "professionals", professionalId);
    await updateDoc(profRef, {
      password: deleteField(),
      requirePasswordChange: false,
      passwordUpdatedAt: Timestamp.now()
    });

    // 3. Remove a flag do documento do usuário
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      requirePasswordChange: false
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao completar primeiro acesso:", error);
    throw error;
  }
};

export const deleteManagedStaffAccount = async (professionalId, memberEmail) => {
  try {
    let docId = professionalId;
    let authUid = null;

    // 1. Busca o documento do profissional
    const profRef = doc(db, "professionals", professionalId);
    const profSnap = await getDoc(profRef);
    
    if (profSnap.exists()) {
      const profData = profSnap.data();
      authUid = profData.auth_uid;
    } else if (memberEmail) {
      // Fallback: busca por email se o ID direto falhar
      const q = query(collection(db, "professionals"), where("email", "==", memberEmail.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        docId = docSnap.id;
        authUid = docSnap.data().auth_uid;
      } else {
        throw new Error("Profissional não encontrado no banco de dados.");
      }
    } else {
      throw new Error("Profissional não encontrado.");
    }

    // 2. Remove da coleção 'professionals'
    await deleteDoc(doc(db, "professionals", docId));

    // 3. Remove da coleção 'users'
    if (authUid) {
      await deleteDoc(doc(db, "users", authUid));
    } else if (memberEmail) {
      // Fallback para usuários antigos sem auth_uid no documento professional
      const qUser = query(collection(db, "users"), where("email", "==", memberEmail.toLowerCase()));
      const userSnap = await getDocs(qUser);
      if (!userSnap.empty) {
        await deleteDoc(doc(db, "users", userSnap.docs[0].id));
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar conta gerenciada:", error);
    throw error;
  }
};
