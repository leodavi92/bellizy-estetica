import { db, updateUserDocRef, getMessagingSafe, hasVapidKey } from './firebase';
import { collection, addDoc, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { format } from 'date-fns';

/**
 * Hash FNV-1a 32-bit determinístico (síncrono, zero dependências browser).
 * Suficiente para gerar IDs de notificação idempotentes — NÃO usa para criptografia.
 */
function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Gera um ID de notificação DETERMINÍSTICO para idempotência (B-08).
 * Se os mesmos parâmetros forem passados 10 vezes, será sempre o mesmo ID,
 * então setDoc + merge evita duplicatas.
 */
function notifId(estId, action, { appointmentId = null, userId = null, professionalId = null, extra = '' } = {}) {
  const base = [
    estId || 'no-est',
    action || 'no-action',
    appointmentId || 'no-app',
    userId || 'no-user',
    professionalId || 'no-prof',
    extra || ''
  ].join('|');
  // Dois hashes independentes com salting leve = 16 chars hex estáveis.
  const a = fnv1a32(base);
  const b = fnv1a32('salt||' + base + '||v1');
  return `n_${a}${b}`;
}

/**
 * Solicita permissão para notificações e retorna o token FCM
 */
export const requestNotificationPermission = async (userId) => {
  try {
    if (!hasVapidKey) {
      console.info("[FCM] VAPID_KEY não configurada no .env. Notificações push desativadas (não há erro).");
      return null;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.info("[FCM] Browser não suporta Notificações.");
      return null;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const messagingInstance = await getMessagingSafe();
      if (!messagingInstance) {
        console.warn("[FCM] messaging não está disponível neste ambiente (ex: SSR, SW indisponível).");
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn("[FCM] VAPID_KEY faltando em runtime.");
        return null;
      }

      const token = await getToken(messagingInstance, { vapidKey });

      if (token && userId) {
        console.log("Token FCM gerado:", token);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const existingTokens = Array.isArray(userSnap.data().fcmTokens) ? userSnap.data().fcmTokens : [];

          if (existingTokens.includes(token)) {
            console.log("Token FCM já cadastrado previamente. Nenhuma alteração feita.");
          } else {
            const pruned = existingTokens.slice(-9);
            await updateUserDocRef(userRef, {
              fcmTokens: [...pruned, token],
              pushEnabled: true
            });
            console.log("Token FCM registrado no Firestore para o usuário:", userId);
          }
        } else {
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
 * Retorna uma função de unsubscribe (ou null se FCM indisponível)
 */
export const onMessageListener = (onPayload) => {
  if (!hasVapidKey) {
    return () => {};
  }

  let unsubscribe = () => {};
  getMessagingSafe().then(messagingInstance => {
    if (messagingInstance) {
      try {
        unsubscribe = onMessage(messagingInstance, (payload) => {
          console.log("Mensagem recebida em primeiro plano:", payload);
          if (typeof onPayload === 'function') onPayload(payload);
        });
      } catch (_e) {
        console.warn("[FCM] Não foi possível anexar onMessage:", _e);
      }
    }
  }).catch(() => {});

  return () => {
    try { unsubscribe && unsubscribe(); } catch (_e) { /* noop */ }
  };
};

/**
 * Envia uma notificação interna para o profissional
 */
export const createInternalNotification = async (establishmentId, appointmentData) => {
  try {
    const start = appointmentData.data_hora?.toDate ? appointmentData.data_hora.toDate() : new Date(appointmentData.data_hora);
    
    // Normaliza o professional_id para evitar strings 'null' ou valores nulos
    let targetProfessionalId = appointmentData.professional_id;
    
    // Se for nulo, string 'null', vazio ou 'owner', precisamos resolver para o UID real do dono
    const isInvalidId = !targetProfessionalId || 
                        targetProfessionalId === 'null' || 
                        targetProfessionalId === 'undefined' || 
                        targetProfessionalId === 'owner';

    console.log("[NotificationService] ID recebido:", targetProfessionalId, "Inválido?", isInvalidId);

    if (isInvalidId) {
      console.log("[NotificationService] Buscando UID real do administrador para o estabelecimento:", establishmentId);
      const estRef = doc(db, 'establishments', establishmentId);
      const estSnap = await getDoc(estRef);
      if (estSnap.exists()) {
        const estData = estSnap.data();
        targetProfessionalId = estData.owner_id || estData.user_id;
        console.log("[NotificationService] Resolvido para UID real:", targetProfessionalId);
      }
    }

    if (!targetProfessionalId || targetProfessionalId === 'null') {
      console.error("[NotificationService] Não foi possível resolver um UID válido para o envio.");
      return;
    }

    const notificationData = {
      establishment_id: establishmentId,
      professional_id: targetProfessionalId,
      type: 'new_appointment',
      title: 'Novo Agendamento! 📅',
      message: `${appointmentData.user_nome} agendou ${appointmentData.service_nome} para o dia ${format(start, "dd/MM 'às' HH:mm")}`,
      read: false,
      appointment_id: appointmentData.id || 'manual',
      createdAt: Timestamp.now()
    };

    const id = notifId(establishmentId, 'new_appointment', {
      appointmentId: appointmentData.id || 'manual',
      professionalId: targetProfessionalId,
      extra: String(start.getTime())
    });
    await setDoc(doc(db, "notifications", id), notificationData, { merge: true });
    console.log("[NotificationService] Notificação real criada para o UID:", targetProfessionalId, "(idempotente:", id, ")");
  } catch (err) {
    console.error("Erro ao criar notificação interna:", err);
  }
};

/**
 * Cria uma notificação para o cliente (idempotente por estId + userId + type + appointmentId)
 */
export const createClientNotification = async (establishmentId, userId, type, title, message, appointmentId = null, extra = '') => {
  try {
    const id = notifId(establishmentId, type, { userId, appointmentId, extra });
    await setDoc(doc(db, "notifications", id), {
      establishment_id: establishmentId,
      user_id: userId,
      type,
      title,
      message,
      appointment_id: appointmentId,
      read: false,
      createdAt: Timestamp.now()
    }, { mergeFields: ['read'] }); // Não sobrescreve se já foi lido
  } catch (err) {
    console.error("Erro ao criar notificação para o cliente:", err);
  }
};

/**
 * Helper genérico: cria/atualiza notificação de ação sobre appointment (admin/cancelled/completed/rescheduled)
 * com idempotência via appointment_id + type + professional_id/user_id.
 */
export const createAppointmentEventNotification = async ({
  establishment_id,
  targetProfessionalId = null,
  targetUserId = null,
  type,
  title,
  message,
  appointment_id = null,
  extra = ''
}) => {
  try {
    if (!targetProfessionalId && !targetUserId) return;
    const id = notifId(establishment_id, type, {
      appointmentId: appointment_id,
      userId: targetUserId,
      professionalId: targetProfessionalId,
      extra
    });
    const data = {
      establishment_id,
      type,
      title,
      message,
      read: false,
      appointment_id,
      createdAt: Timestamp.now()
    };
    if (targetProfessionalId) data.professional_id = targetProfessionalId;
    if (targetUserId) data.user_id = targetUserId;
    await setDoc(doc(db, "notifications", id), data, { mergeFields: ['read'] });
  } catch (err) {
    console.error("Erro ao criar notificação de evento de agendamento:", err);
  }
};
