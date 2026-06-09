import { db, messaging } from './firebase';
import { collection, addDoc, Timestamp, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { format } from 'date-fns';

/**
 * Solicita permissão para notificações e retorna o token FCM
 */
export const requestNotificationPermission = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // Você precisará gerar isso no Console do Firebase
      });

      if (token && userId) {
        console.log("Token FCM gerado:", token);
        // Salva o token no documento do usuário para envios futuros
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token),
            pushEnabled: true,
            updatedAt: Timestamp.now()
          });
          console.log("Token FCM registrado no Firestore para o usuário:", userId);
        } else {
          // Se o documento na coleção 'users' não existir (raro, mas possível dependendo do fluxo de login), tenta criar ou avisar
          console.warn("Documento do usuário não encontrado na coleção 'users'. Verifique a estrutura do banco.");
        }
        return token;
      }
    } else {
      console.warn("Permissão de notificação negada");
    }
  } catch (err) {
    console.error("Erro ao solicitar permissão de notificação:", err);
  }
  return null;
};

/**
 * Escuta mensagens quando o app está em primeiro plano
 */
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Mensagem recebida em primeiro plano:", payload);
      resolve(payload);
    });
  });

/**
 * Envia uma notificação interna para o profissional
 */
export const createInternalNotification = async (establishmentId, appointmentData) => {
  try {
    const start = appointmentData.data_hora?.toDate ? appointmentData.data_hora.toDate() : new Date(appointmentData.data_hora);
    
    // Busca o owner_id do estabelecimento se o professional_id for 'owner'
    let targetProfessionalId = appointmentData.professional_id || 'owner';
    
    if (targetProfessionalId === 'owner') {
      const estRef = doc(db, 'establishments', establishmentId);
      const estSnap = await getDoc(estRef);
      if (estSnap.exists()) {
        targetProfessionalId = estSnap.data().owner_id || 'owner';
      }
    }

    await addDoc(collection(db, "notifications"), {
      establishment_id: establishmentId,
      professional_id: targetProfessionalId,
      type: 'new_appointment',
      title: 'Novo Agendamento! 📅',
      message: `${appointmentData.user_nome} agendou ${appointmentData.service_nome} para o dia ${format(start, "dd/MM 'às' HH:mm")}`,
      read: false,
      appointment_id: appointmentData.id,
      createdAt: Timestamp.now()
    });
  } catch (err) {
    console.error("Erro ao criar notificação interna:", err);
  }
};

/**
 * Simula o disparo de e-mail de confirmação (via Resend/EmailJS)
 * Para ativar realmente, você precisará configurar as chaves de API
 */
export const sendConfirmationEmail = async (clientEmail, appointmentData) => {
  console.log(`[Email Service] Enviando confirmação para ${clientEmail}...`);
  
  // Exemplo de como seria a integração com EmailJS:
  // emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
  //   to_name: appointmentData.user_nome,
  //   service_name: appointmentData.service_nome,
  //   date: format(appointmentData.data_hora, "dd/MM/yyyy HH:mm"),
  //   professional_name: appointmentData.professional_name
  // });

  return true;
};

/**
 * Cria uma notificação para o cliente
 */
export const createClientNotification = async (establishmentId, userId, type, title, message) => {
  try {
    await addDoc(collection(db, "notifications"), {
      establishment_id: establishmentId,
      user_id: userId,
      type,
      title,
      message,
      read: false,
      createdAt: Timestamp.now()
    });
  } catch (err) {
    console.error("Erro ao criar notificação para o cliente:", err);
  }
};
