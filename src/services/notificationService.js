import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

/**
 * Envia uma notificação interna para o profissional
 */
export const createInternalNotification = async (establishmentId, appointmentData) => {
  try {
    const start = appointmentData.data_hora?.toDate ? appointmentData.data_hora.toDate() : new Date(appointmentData.data_hora);
    
    await addDoc(collection(db, "notifications"), {
      establishment_id: establishmentId,
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
