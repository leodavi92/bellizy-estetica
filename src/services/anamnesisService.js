import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  orderBy,
  Timestamp,
  getDoc
} from 'firebase/firestore';

/**
 * Gerencia modelos de fichas de anamnese
 */
export const anamnesisService = {
  // --- TEMPLATES (Modelos de Ficha) ---
  
  async getTemplates(establishmentId) {
    try {
      const q = query(
        collection(db, 'anamnesis_templates'),
        where('establishment_id', '==', establishmentId)
      );
      const snap = await getDocs(q);
      const templates = snap.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          id: d.id // Garante que o ID do documento seja usado, mesmo que haja um campo 'id' no data
        };
      });
      
      // Ordena em memória para evitar a necessidade de índice composto no Firestore
      return templates.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Erro ao buscar modelos de anamnese:", error);
      return [];
    }
  },

  async saveTemplate(establishmentId, templateData) {
    try {
      // Remove o ID do corpo do documento para não duplicar ou salvar como null
      const { id, ...data } = templateData;
      
      if (id) {
        const ref = doc(db, 'anamnesis_templates', id);
        await updateDoc(ref, {
          ...data,
          updatedAt: Timestamp.now()
        });
        return id;
      } else {
        const ref = await addDoc(collection(db, 'anamnesis_templates'), {
          ...data,
          establishment_id: establishmentId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        return ref.id;
      }
    } catch (error) {
      console.error("Erro ao salvar modelo de anamnese:", error);
      throw error;
    }
  },

  async deleteTemplate(templateId) {
    if (!templateId) {
      console.warn("Tentativa de deletar template sem ID válido.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'anamnesis_templates', templateId));
    } catch (error) {
      console.error("Erro ao deletar modelo de anamnese:", error);
      throw error;
    }
  },

  // --- RESPONSES (Fichas Preenchidas) ---

  async saveResponse(establishmentId, customerId, responseData) {
    try {
      const ref = await addDoc(collection(db, 'anamnesis_responses'), {
        ...responseData,
        establishment_id: establishmentId,
        customer_id: customerId,
        createdAt: Timestamp.now()
      });
      return ref.id;
    } catch (error) {
      console.error("Erro ao salvar resposta de anamnese:", error);
      throw error;
    }
  },

  async getResponsesByCustomer(establishmentId, customerIds) {
    try {
      const ids = Array.isArray(customerIds) ? customerIds : [customerIds];
      const q = query(
        collection(db, 'anamnesis_responses'),
        where('establishment_id', '==', establishmentId),
        where('customer_id', 'in', ids)
      );
      const snap = await getDocs(q);
      const responses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordena em memória para evitar a necessidade de índice composto
      return responses.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Erro ao buscar respostas de anamnese:", error);
      return [];
    }
  },

  async getResponseByAppointment(appointmentId, templateId = null) {
    try {
      let q;
      if (templateId) {
        q = query(
          collection(db, 'anamnesis_responses'),
          where('appointment_id', '==', appointmentId),
          where('template_id', '==', templateId)
        );
      } else {
        q = query(
          collection(db, 'anamnesis_responses'),
          where('appointment_id', '==', appointmentId)
        );
      }
      
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (error) {
      console.error("Erro ao buscar resposta por agendamento:", error);
      return null;
    }
  },

  async getResponsesByTemplate(establishmentId, templateId) {
    try {
      const q = query(
        collection(db, 'anamnesis_responses'),
        where('establishment_id', '==', establishmentId),
        where('template_id', '==', templateId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Erro ao buscar respostas por template:", error);
      return [];
    }
  }
};
