import { getAuth, updatePassword } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getApp } from "firebase/app";
import { db } from "./firebase";
import { doc, updateDoc, Timestamp, deleteField } from "firebase/firestore";

const FUNCTIONS_REGION = "southamerica-east1";
const functions = getFunctions(getApp(), FUNCTIONS_REGION);

if (import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "localhost", 5001);
}

const createStaffAccountFn = httpsCallable(functions, "createStaffAccount");
const deleteStaffAccountFn = httpsCallable(functions, "deleteStaffAccount");

export const createManagedStaffAccount = async (memberData, establishment) => {
  try {
    const result = await createStaffAccountFn({
      nome: memberData.nome,
      cargo: memberData.cargo,
      servicos: memberData.servicos || [],
      email: memberData.email,
    });

    const data = result.data || {};

    return {
      success: true,
      email: data.email,
      password: data.temporaryPassword,
      professionalId: data.professionalId,
      passwordResetLink: data.passwordResetLink,
    };
  } catch (error) {
    console.error("Erro ao criar conta gerenciada:", error);

    const code = error?.code || error?.details?.code;

    if (code === "already-exists") {
      throw new Error("Este e-mail já está em uso por outro profissional.");
    }
    if (code === "permission-denied") {
      throw new Error("Você não tem permissão para criar profissionais.");
    }
    if (code === "invalid-argument") {
      throw new Error(error.message || "Dados inválidos para criar profissional.");
    }

    throw error;
  }
};

export const completeProfessionalFirstAccess = async (uid, professionalId, newPassword) => {
  try {
    const currentUser = getAuth().currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Usuário não autenticado corretamente");
    }

    await updatePassword(currentUser, newPassword);

    const profRef = doc(db, "professionals", professionalId);
    await updateDoc(profRef, {
      // Mantemos deleteField() para compatibilidade com profissionais criados ANTES
      // da correção C4, que tinham senha gravada. Para os novos, não terá efeito.
      password: deleteField(),
      requirePasswordChange: false,
      passwordUpdatedAt: Timestamp.now(),
    });

    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      requirePasswordChange: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Erro ao completar primeiro acesso:", error);
    throw error;
  }
};

export const deleteManagedStaffAccount = async (professionalId) => {
  try {
    await deleteStaffAccountFn({ professionalId });
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar conta gerenciada:", error);

    const code = error?.code || error?.details?.code;
    if (code === "not-found") {
      throw new Error("Profissional não encontrado.");
    }
    if (code === "permission-denied") {
      throw new Error("Você não tem permissão para excluir este profissional.");
    }

    throw error;
  }
};
