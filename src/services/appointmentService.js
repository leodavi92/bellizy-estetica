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

/**
 * CONSTANTES DE STATUS PADRONIZADAS (O MOTOR DO SISTEMA)
 */
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled', // Agendado e ativo
  CONFIRMED: 'confirmed', // Confirmado (opcional se houver fluxo de aprovação)
  COMPLETED: 'completed', // Finalizado
  CANCELLED: 'cancelled'  // Cancelado
};

/**
 * Status que bloqueiam a agenda para evitar conflitos.
 * Qualquer agendamento que não seja 'cancelled' deve ser considerado um bloqueio.
 */
export const BLOCKED_STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED, // Mesmo finalizado, o slot de tempo continua ocupado no passado
  'ativo', 'Ativo', 'confirmado', 'Confirmado', 'scheduled', 'Scheduled' // Legados para compatibilidade durante transição
];

const getSafeDate = (val) => {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Normaliza o ID do profissional para evitar problemas com strings/null/undefined
 * REGRA 3: Owner é profissional comum.
 */
const normalizeProfId = (id) => {
  if (!id || id === 'null' || id === 'undefined' || id === '') return 'owner';
  return String(id).trim();
};

/**
 * Normaliza o status de um agendamento para o padrão do sistema.
 */
export const normalizeStatus = (status) => {
  if (!status) return APPOINTMENT_STATUS.SCHEDULED;
  const s = String(status).toLowerCase().trim();
  
  if (['cancelled', 'cancelado'].includes(s)) return APPOINTMENT_STATUS.CANCELLED;
  if (['completed', 'finalizado'].includes(s)) return APPOINTMENT_STATUS.COMPLETED;
  if (['confirmed', 'confirmado'].includes(s)) return APPOINTMENT_STATUS.CONFIRMED;
  
  return APPOINTMENT_STATUS.SCHEDULED;
};

/**
 * Transforma um agendamento em uma lista de slots ocupados por profissional.
 * REGRA 4: Profissional por serviço.
 */
const getBusySlotsFromAppointment = (appData) => {
  const start = getSafeDate(appData.start_time) || getSafeDate(appData.data_hora);
  if (!start) return [];

  const slots = [];
  const services = appData.services && Array.isArray(appData.services) ? appData.services : [];

  if (services.length > 0) {
    let currentOffset = 0;
    services.forEach(s => {
      const sDuration = Number(s.duracao || s.duration || 30);
      const sStart = addMinutes(start, currentOffset);
      const sEnd = addMinutes(sStart, sDuration);
      
      const pId = normalizeProfId(s.professional_id || appData.professional_id);
      
      slots.push({
        profId: pId,
        start: sStart,
        end: sEnd,
        client: appData.user_nome || 'Cliente',
        serviceName: s.nome || 'Serviço'
      });
      currentOffset += sDuration;
    });
  } else {
    const dur = Number(appData.total_duration || appData.duration || 30);
    const end = getSafeDate(appData.end_time) || addMinutes(start, dur);
    slots.push({
      profId: normalizeProfId(appData.professional_id),
      start: start,
      end: end,
      client: appData.user_nome || 'Cliente',
      serviceName: appData.service_nome || 'Serviço'
    });
  }
  return slots;
};

/**
 * MOTOR SEQUENCIAL: Calcula horários disponíveis para combos ou serviços individuais.
 * REGRA 1: Cadeia completa obrigatória.
 * REGRA 2: Simulação sequencial etapa por etapa.
 */
export const getMultiProfessionalAvailableSlots = async (date, serviceAssignments, establishmentId) => {
  if (!establishmentId || !serviceAssignments.length) return [];
  
  try {
    // REORDENAMENTO POR PRIORIDADE (Opção B): Serviços com prioridade 1 vêm primeiro
    const sortedAssignments = [...serviceAssignments].sort((a, b) => {
      const prioA = a.service?.prioridade || 0;
      const prioB = b.service?.prioridade || 0;
      return prioB - prioA; // Maior prioridade primeiro
    });

    const establishmentRef = doc(db, 'establishments', establishmentId);
    const establishmentSnap = await getDoc(establishmentRef);
    if (!establishmentSnap.exists()) return [];
    
    const establishment = establishmentSnap.data();
    const settings = establishment.settings || { horario_inicio: "08:00", horario_fim: "18:00" };
    const availabilityRules = establishment.availability_rules || null;
    const blockedSlots = establishment.blocked_slots || [];
    const bufferTime = Number(settings.buffer_time || 0);
    const slotInterval = Number(settings.slot_interval || 30);
    
    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
    const dayConfig = availabilityRules ? availabilityRules[dayName] : null;
    if (dayConfig && !dayConfig.enabled) return [];

    const startTimeStr = dayConfig ? dayConfig.start : settings.horario_inicio;
    const endTimeStr = dayConfig ? dayConfig.end : settings.horario_fim;
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    const now = new Date();

    // 1. Identificar todos os profissionais únicos envolvidos
    const uniqueProfessionalIds = [...new Set(serviceAssignments.map(a => normalizeProfId(a.professionalId)))];
    
    // 1.1 Buscar dados dos profissionais para checar horários de pausa
    const professionalsData = {};
    for (const profId of uniqueProfessionalIds) {
      if (profId === 'owner') {
        professionalsData['owner'] = establishment.settings?.owner_breaks || null;
      } else {
        const profDoc = await getDoc(doc(db, "professionals", profId));
        if (profDoc.exists()) {
          professionalsData[profId] = profDoc.data().break_time || null;
        }
      }
    }
    
    // 2. Buscar agendamentos do dia
    let allDayApps = [];
    try {
      const qAllDay = query(
        collection(db, "appointments"),
        where("establishment_id", "==", establishmentId)
      );
      
      const allDaySnap = await getDocs(qAllDay);
      allDayApps = allDaySnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(app => {
          const start = getSafeDate(app.start_time) || getSafeDate(app.data_hora);
          const isActive = BLOCKED_STATUSES.includes(app.status);
          const isSameDay = start && start >= dayStart && start <= dayEnd;
          return isActive && isSameDay;
        });
    } catch (err) {
      if (err.code === 'permission-denied') {
        console.warn("Acesso restrito aos agendamentos. Verificando disponibilidade via motor alternativo ou regras simplificadas.");
        // Se o cliente não tem permissão para ler a coleção completa, o sistema deve 
        // falhar graciosamente ou usar uma função do backend (Cloud Function) no futuro.
        // Por enquanto, vamos retornar vazio para não travar a UI, mas o ideal é 
        // que o admin tenha as regras de segurança permitindo a leitura de slots ocupados.
      } else {
        throw err;
      }
    }

    // 3. Organizar slots ocupados por profissional
    const professionalBusySlots = {};
    for (const profId of uniqueProfessionalIds) {
      const busy = [];
      allDayApps.forEach(app => {
        const appSlots = getBusySlotsFromAppointment(app);
        appSlots.forEach(slot => {
          if (slot.profId === profId) {
            busy.push(slot);
          }
        });
      });

      // REGRA 10: Bloqueios manuais
      blockedSlots.forEach(block => {
        if (block.date === dateStr) {
          const [bStartH, bStartM] = block.start_time.split(':').map(Number);
          const [bEndH, bEndM] = block.end_time.split(':').map(Number);
          const bStart = new Date(date); bStart.setHours(bStartH, bStartM, 0, 0);
          const bEnd = new Date(date); bEnd.setHours(bEndH, bEndM, 0, 0);
          busy.push({ start: bStart, end: bEnd, client: 'BLOQUEIO', serviceName: block.reason || 'Manual' });
        }
      });

      // REGRA NOVA: Horário de Almoço / Pausas Fixas do Profissional
      const breakTime = professionalsData[profId];
      if (breakTime && breakTime.enabled && breakTime.start && breakTime.end) {
        try {
          const [bStartH, bStartM] = breakTime.start.split(':').map(Number);
          const [bEndH, bEndM] = breakTime.end.split(':').map(Number);
          
          if (!isNaN(bStartH) && !isNaN(bEndH)) {
            const bStart = new Date(date); bStart.setHours(bStartH, bStartM, 0, 0);
            const bEnd = new Date(date); bEnd.setHours(bEndH, bEndM, 0, 0);
            busy.push({ 
              start: bStart, 
              end: bEnd, 
              client: 'PAUSA', 
              serviceName: 'Horário de Almoço/Pausa',
              isBreak: true
            });
          }
        } catch (e) {
          console.warn(`Erro ao processar intervalo do profissional ${profId}:`, e);
        }
      }

      // REGRA NOVA 2: Horário de Almoço / Pausa Fixa Geral do Estabelecimento
      if (dayConfig && dayConfig.break_enabled && dayConfig.break_start && dayConfig.break_end) {
        try {
          const [bStartH, bStartM] = dayConfig.break_start.split(':').map(Number);
          const [bEndH, bEndM] = dayConfig.break_end.split(':').map(Number);
          
          if (!isNaN(bStartH) && !isNaN(bEndH)) {
            const bStart = new Date(date); bStart.setHours(bStartH, bStartM, 0, 0);
            const bEnd = new Date(date); bEnd.setHours(bEndH, bEndM, 0, 0);
            busy.push({ 
              start: bStart, 
              end: bEnd, 
              client: 'PAUSA', 
              serviceName: 'Intervalo Geral (Almoço)',
              isBreak: true // Flag para identificar que é uma pausa e não um agendamento
            });
          }
        } catch (e) {
          console.warn("Erro ao processar horário de intervalo:", e);
        }
      }

      professionalBusySlots[profId] = busy;
    }

    let availableSlots = [];
    let currentCursor = new Date(date);
    currentCursor.setHours(startH, startM, 0, 0);
    const dayLimit = new Date(date);
    dayLimit.setHours(endH, endM, 0, 0);

    // REGRA CRÍTICA: Seguir a grade configurada (30 em 30 min)
    while (currentCursor < dayLimit) {
      let isSequenceValid = true;
      let sequenceTimeCursor = new Date(currentCursor);
      let auditLogs = [];

      // Percorre cada serviço do combo na ordem definida pela prioridade
      for (let i = 0; i < sortedAssignments.length; i++) {
        const assignment = sortedAssignments[i];
        const nextAssignment = sortedAssignments[i + 1];
        
        const profId = normalizeProfId(assignment.professionalId);
        const nextProfId = nextAssignment ? normalizeProfId(nextAssignment.professionalId) : null;
        
        const serviceDur = Number(assignment.service.duracao || 30);
        const slotStart = new Date(sequenceTimeCursor);
        const slotEnd = addMinutes(slotStart, serviceDur);

        // REGRA 12: Fechamento do estabelecimento
        if (slotEnd > dayLimit) {
          isSequenceValid = false;
          auditLogs.push(`INVALIDADO: Fim do serviço (${format(slotEnd, 'HH:mm')}) ultrapassa fechamento.`);
          break;
        }

        // REGRA 9 & 7 & 8: Overlap e Buffer
        const busySlots = professionalBusySlots[profId] || [];
        const isSameProfNext = profId === nextProfId;
        
        const conflict = busySlots.find(busy => {
          // REGRA 5: Se o próximo serviço for o mesmo profissional, não precisamos de buffer AGORA.
          // REGRA NOVA: Intervalos/Pausas não geram buffer, são apenas bloqueios fixos.
          const isBreak = !!busy.isBreak;
          const effectiveBuffer = (isSameProfNext || isBreak) ? 0 : bufferTime;
          
          // Agendamentos EXISTENTES têm buffer no fim, exceto se for uma PAUSA/INTERVALO
          const busyEndWithBuffer = isBreak ? busy.end : addMinutes(busy.end, bufferTime); 
          
          // O slot que estamos tentando encaixar só precisa de buffer se não for seguido pelo mesmo profissional
          const slotEndWithBuffer = addMinutes(slotEnd, effectiveBuffer);
          
          // REGRA 8: Sobreposição rigorosa
          const overlaps = slotStart < busyEndWithBuffer && slotEnd > busy.start;
          return overlaps;
        });

        if (conflict || !isAfter(slotStart, now)) {
          isSequenceValid = false;
          if (conflict) {
            auditLogs.push(`INVALIDADO: Profissional ${profId} ocupado das ${format(conflict.start, 'HH:mm')} às ${format(conflict.end, 'HH:mm')} (+buffer) por ${conflict.client}.`);
          } else {
            auditLogs.push(`INVALIDADO: Horário passado.`);
          }
          break;
        }

        sequenceTimeCursor = slotEnd;
      }

      if (isSequenceValid) {
        availableSlots.push(new Date(currentCursor));
      } else {
        // REGRA 15: Logs de auditoria (opcional no console para debug)
        // console.log(`[AUDIT] Slot ${format(currentCursor, 'HH:mm')}:`, auditLogs);
      }
      
      currentCursor = addMinutes(currentCursor, slotInterval);
    }

    return availableSlots;
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
