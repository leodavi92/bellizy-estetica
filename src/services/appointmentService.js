import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp, 
  doc, 
  updateDoc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { 
  format, 
  addMinutes, 
  isAfter, 
  startOfDay, 
  endOfDay, 
  parseISO, 
  isSameMinute 
} from 'date-fns';
import { createInternalNotification } from './notificationService';
import { enUS } from 'date-fns/locale';
import {
  calculateAvailableSlotsEngine,
  getBusySlotsFromAppointment,
  getSafeDate,
  normalizeProfId,
  normalizeStatus as engineNormalizeStatus,
  APPOINTMENT_STATUS,
  BLOCKED_STATUSES,
} from './appointmentEngine';

// Re-exporta helpers para manter retrocompatibilidade com arquivos antigos
// que importavam diretamente de appointmentService.
export const normalizeStatus = engineNormalizeStatus;
export { APPOINTMENT_STATUS, BLOCKED_STATUSES, getBusySlotsFromAppointment, normalizeProfId, getSafeDate };

/**
 * MOTOR SEQUENCIAL: Calcula horários disponíveis para combos ou serviços individuais.
 * REGRA 1: Cadeia completa obrigatória.
 * REGRA 2: Simulação sequencial etapa por etapa.
 *
 * IMPLEMENTAÇÃO REFATORADA (C8.4):
 *   - Parte I/O (Firestore) aqui: dados do estab, profissionais, apps do dia.
 *   - Parte CPU (lógica) em `calculateAvailableSlotsEngine` (pura, 100% testada offline).
 */
export const getMultiProfessionalAvailableSlots = async (date, serviceAssignments, establishmentId) => {
  if (!establishmentId || !serviceAssignments.length) return [];

  try {
    const establishmentRef = doc(db, 'establishments', establishmentId);
    const establishmentSnap = await getDoc(establishmentRef);
    if (!establishmentSnap.exists()) return [];

    const establishment = establishmentSnap.data();
    const settings = establishment.settings || { horario_inicio: "08:00", horario_fim: "18:00" };
    const availabilityRules = establishment.availability_rules || null;
    const blockedSlots = establishment.blocked_slots || [];

    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
    const dayConfig = availabilityRules ? availabilityRules[dayName] : null;
    if (dayConfig && !dayConfig.enabled) return [];

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const uniqueProfessionalIds = [...new Set(serviceAssignments.map(a => normalizeProfId(a.professionalId)))];
    const professionalsBreakTime = {};
    for (const profId of uniqueProfessionalIds) {
      if (profId === 'owner') {
        professionalsBreakTime['owner'] = establishment.settings?.owner_breaks || null;
      } else {
        const profDoc = await getDoc(doc(db, "professionals", profId));
        if (profDoc.exists()) {
          professionalsBreakTime[profId] = profDoc.data().break_time || null;
        }
      }
    }

    // --- Busca agendamentos ATIVOS do dia com filtro no índice composto (C6)
    let allDayApps = [];
    try {
      const qAllDay = query(
        collection(db, "appointments"),
        where("establishment_id", "==", establishmentId),
        where("start_time", ">=", Timestamp.fromDate(dayStart)),
        where("start_time", "<=", Timestamp.fromDate(dayEnd))
      );
      const allDaySnap = await getDocs(qAllDay);
      allDayApps = allDaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      if (err.code === 'permission-denied') {
        console.warn("Acesso restrito (non-staff). Validação final na createAppointment.");
        allDayApps = [];
      } else if (err.code === 'failed-precondition') {
        console.warn("[appointmentService] Índice composto (establishment_id + start_time) não criado ainda.");
        throw new Error("Sistema em atualização. Aguarde 1 minuto e recarregue. (Criando índices do banco de dados).");
      } else {
        throw err;
      }
    }

    // --- Delega a lógica para a engine PURA (100% testada em vitest — C8)
    const { slots } = calculateAvailableSlotsEngine(date, serviceAssignments, {
      settings,
      availabilityRules,
      blockedSlots,
      activeAppointments: allDayApps,
      professionalsBreakTime,
    });

    return slots;
  } catch (error) {
    console.error("ERRO NO MOTOR SEQUENCIAL:", error);
    return [];
  }
};

/**
 * REGRA CENTRAL: getAvailableSlots usa o motor sequencial.
 */
export const getAvailableSlots = async (date, totalDuration, establishmentId, professionalId = null) => {
  const fakeAssignments = [{
    service: { duracao: totalDuration, nome: 'Serviço Individual' },
    professionalId: normalizeProfId(professionalId)
  }];
  return getMultiProfessionalAvailableSlots(date, fakeAssignments, establishmentId);
};

/**
 * REGRA 14: Revalidação Atômica via Transação.
 */
export const createAppointment = async (appointmentData) => {
  if (!appointmentData.establishment_id) throw new Error("ID do estabelecimento é obrigatório");

  try {
    const resultId = await runTransaction(db, async (transaction) => {
      const { 
        data_hora, 
        services, 
        total_duration, 
        total_price,
        professional_id,
        establishment_id,
        ...rest 
      } = appointmentData;

      const start = getSafeDate(data_hora);
      const dur = Number(total_duration || 30);
      const end = addMinutes(start, dur);
      const dayStart = startOfDay(start);
      const dayEnd = endOfDay(start);

      // 1. Re-validar tudo rigorosamente antes de gravar
      const qConflict = query(
        collection(db, "appointments"),
        where("establishment_id", "==", establishment_id)
      );
      
      const conflictSnap = await getDocs(qConflict);
      const activeApps = conflictSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(app => {
          const aStart = getSafeDate(app.start_time) || getSafeDate(app.data_hora);
          return BLOCKED_STATUSES.includes(app.status) && aStart >= dayStart && aStart <= dayEnd;
        });

      const estRef = doc(db, 'establishments', establishment_id);
      const estSnap = await transaction.get(estRef);
      const bufferTime = estSnap.exists() ? Number(estSnap.data().settings?.buffer_time || 0) : 0;

      // Slots pretendidos
      const newSlots = getBusySlotsFromAppointment({
        ...appointmentData,
        start_time: start,
        total_duration: dur
      });

      // Checagem de Conflito
      for (const nSlot of newSlots) {
        for (const app of activeApps) {
          const existingSlots = getBusySlotsFromAppointment(app);
          for (const eSlot of existingSlots) {
            if (nSlot.profId === eSlot.profId) {
              const eEndWithBuffer = addMinutes(eSlot.end, bufferTime);
              // REGRA 8: candidateStart < busyEnd AND candidateEnd > busyStart
              if (nSlot.start < eEndWithBuffer && nSlot.end > eSlot.start) {
                console.warn(`[REGRA 14] Bloqueio Atômico: Conflito detectado com ${app.user_nome}`);
                const error = new Error("Este horário acabou de ser preenchido por outra pessoa.");
                error.code = "SLOT_TAKEN";
                throw error;
              }
            }
          }
        }
      }

      // 2. Se passou na validação, grava
      const docRef = doc(collection(db, "appointments"));
      transaction.set(docRef, {
        ...rest,
        establishment_id,
        services: services || [],
        total_duration: dur,
        total_price: total_price || 0,
        professional_id: normalizeProfId(professional_id),
        start_time: Timestamp.fromDate(start),
        end_time: Timestamp.fromDate(end),
        data_hora: Timestamp.fromDate(start),
        duration: dur,
        status: normalizeStatus(appointmentData.status || APPOINTMENT_STATUS.SCHEDULED),
        createdAt: Timestamp.now()
      });

      const docId = docRef.id;

      return docId;
    });

    // Gatilhos de Notificação (Executados APÓS a transação ter sucesso)
    const appointmentWithId = { 
      ...appointmentData, 
      id: resultId,
      status: normalizeStatus(appointmentData.status || APPOINTMENT_STATUS.SCHEDULED)
    };
    await createInternalNotification(appointmentData.establishment_id, appointmentWithId);

    return resultId;
  } catch (error) {
    if (error.code !== "SLOT_TAKEN") {
      console.error("ERRO AO CRIAR AGENDAMENTO:", error);
    }
    throw error;
  }
};

/**
 * Busca configurações do estabelecimento
 */
export const getSettings = async (establishmentId) => {
  if (!establishmentId) return { horario_inicio: "08:00", horario_fim: "18:00" };
  try {
    const establishmentRef = doc(db, 'establishments', establishmentId);
    const establishmentSnap = await getDoc(establishmentRef);
    if (establishmentSnap.exists()) {
      return establishmentSnap.data().settings || { horario_inicio: "08:00", horario_fim: "18:00" };
    }
  } catch (error) {
    console.error("Erro ao buscar configurações do estabelecimento:", error);
  }
  return { horario_inicio: "08:00", horario_fim: "18:00" }; // Default
};

/**
 * Busca serviços de um estabelecimento específico
 */
export const getServices = async (establishmentId) => {
  if (!establishmentId) return [];
  try {
    const q = query(
      collection(db, "services"), 
      where("establishment_id", "==", establishmentId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    return [];
  }
};

/**
 * Busca agendamentos de um usuário
 */
export const getMyAppointments = async (userId, establishmentId = null) => {
  if (!userId) return [];
  try {
    let q = query(collection(db, "appointments"), where("user_id", "==", userId));
    if (establishmentId) {
      q = query(q, where("establishment_id", "==", establishmentId));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const dateA = getSafeDate(a.start_time || a.data_hora);
        const dateB = getSafeDate(b.start_time || b.data_hora);
        return dateB - dateA;
      });
  } catch (error) {
    console.error("Erro ao buscar agendamentos do cliente:", error);
    return [];
  }
};

/**
 * Cancela um agendamento
 */
export const cancelAppointment = async (appointmentId) => {
  try {
    const ref = doc(db, "appointments", appointmentId);
    return await updateDoc(ref, { status: APPOINTMENT_STATUS.CANCELLED });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    throw error;
  }
};
