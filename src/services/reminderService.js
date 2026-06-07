import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';

export const reminderService = {
  async getReminders(establishmentId) {
    try {
      const q = query(
        collection(db, 'reminders'),
        where('establishment_id', '==', establishmentId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Erro ao buscar lembretes:", error);
      return [];
    }
  },

  async saveReminder(establishmentId, reminderData) {
    try {
      if (reminderData.id) {
        const ref = doc(db, 'reminders', reminderData.id);
        await updateDoc(ref, {
          ...reminderData,
          updatedAt: serverTimestamp()
        });
        return reminderData.id;
      } else {
        const ref = await addDoc(collection(db, 'reminders'), {
          ...reminderData,
          establishment_id: establishmentId,
          createdAt: serverTimestamp()
        });
        return ref.id;
      }
    } catch (error) {
      console.error("Erro ao salvar lembrete:", error);
      throw error;
    }
  },

  async deleteReminder(id) {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      console.error("Erro ao excluir lembrete:", error);
      throw error;
    }
  }
};
