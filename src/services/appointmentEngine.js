// ============================================================
// MUSA AGENDA — MOTOR SEQUENCIAL DE AGENDAMENTO (PURO)
// ============================================================
// Função 100% PURA: sem efeitos colaterais, sem chamadas de rede,
// sem Firestore, sem async. Tudo é passado como parâmetro.
// Perfeita para testes offline unitários e auditoria.
// ============================================================

import {
  addMinutes,
  isAfter,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';

// ------------------------------------------------------------
// Constantes públicas (reutilizadas pelo resto do app)
// ------------------------------------------------------------
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const BLOCKED_STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED,
  'ativo', 'Ativo', 'confirmado', 'Confirmado',
  'scheduled', 'Scheduled', 'pending', 'active', 'manual', 'completed_em_aberto',
];

export const normalizeStatus = (status) => {
  if (!status) return APPOINTMENT_STATUS.SCHEDULED;
  const s = String(status).toLowerCase().trim();
  if (['cancelled', 'cancelado', 'deleted'].includes(s)) return APPOINTMENT_STATUS.CANCELLED;
  if (['completed', 'finalizado'].includes(s)) return APPOINTMENT_STATUS.COMPLETED;
  if (['confirmed', 'confirmado'].includes(s)) return APPOINTMENT_STATUS.CONFIRMED;
  return APPOINTMENT_STATUS.SCHEDULED;
};

// ------------------------------------------------------------
// Helpers internos (também exportados para teste/reuso)
// ------------------------------------------------------------

export const getSafeDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export const normalizeProfId = (id) => {
  if (!id || id === 'null' || id === 'undefined' || id === '') return 'owner';
  return String(id).trim();
};

/**
 * Transforma UM agendamento em N slots ocupados (um por serviço/etapa).
 * @returns {Array<{profId, start, end, client, serviceName}>}
 */
export const getBusySlotsFromAppointment = (appData) => {
  const start = getSafeDate(appData.start_time) || getSafeDate(appData.data_hora);
  if (!start) return [];

  const slots = [];
  const services = appData.services && Array.isArray(appData.services)
    ? appData.services
    : [];

  if (services.length > 0) {
    let currentOffset = 0;
    services.forEach((s) => {
      const sDuration = Number(s.duracao || s.duration || 30);
      const sStart = addMinutes(start, currentOffset);
      const sEnd = addMinutes(sStart, sDuration);
      const pId = normalizeProfId(s.professional_id || appData.professional_id);

      slots.push({
        profId: pId,
        start: sStart,
        end: sEnd,
        client: appData.user_nome || 'Cliente',
        serviceName: s.nome || 'Serviço',
      });
      currentOffset += sDuration;
    });
  } else {
    const dur = Number(appData.total_duration || appData.duration || 30);
    const end = getSafeDate(appData.end_time) || addMinutes(start, dur);
    slots.push({
      profId: normalizeProfId(appData.professional_id),
      start,
      end,
      client: appData.user_nome || 'Cliente',
      serviceName: appData.service_nome || 'Serviço',
    });
  }
  return slots;
};

// ============================================================
//  INTERFACE PRINCIPAL — CALCULA SLOTS DISPONÍVEIS
// ============================================================
/**
 * Tudo o que o motor PRECISA saber, vem via parâmetro (100% Puro).
 *
 * @param {Date}   date                    — Dia candidato (apenas dia/mês/ano importa).
 * @param {Array}  serviceAssignments      — [{service:{duracao,nome,prioridade}, professionalId}]
 * @param {Object} options
 * @param {Object} options.settings           — establishment.settings (horario_inicio, horario_fim, buffer_time, slot_interval, owner_breaks)
 * @param {Object|null} options.availabilityRules — establishment.availability_rules[dayName].enabled/start/end/break_start/break_enabled/...
 * @param {Array}  options.blockedSlots     — establishment.blocked_slots[{date:'yyyy-MM-dd',start_time:'HH:mm',end_time:'HH:mm', reason}]
 * @param {Array}  options.activeAppointments — array de agendamentos do dia (já filtrados por data + BLOCKED_STATUSES). Campos: {start_time, services[], professional_id, status, user_nome, ...}
 * @param {Object} options.professionalsBreakTime — mapa {[profId]: {enabled, start, end}} (break_time do professional doc ou owner_breaks do estab para 'owner')
 * @param {Date}  [options.now=new Date()]  — horário "agora" para bloquear slots passados (sobrescrita para TESTES!)
 * @returns {{
 *   slots: Date[],
 *   audit: {[slotKey: string]: string[]}
 * }}
 */
export function calculateAvailableSlotsEngine(date, serviceAssignments, options = {}) {
  const slots = [];
  const audit = {};

  if (!serviceAssignments || serviceAssignments.length === 0) {
    return { slots: [], audit: {} };
  }

  // ----- 1. Reordena por PRIORIDADE de serviço (prioridade_maxima > outros)
  const sortedAssignments = [...serviceAssignments].sort((a, b) => {
    const prioA = a.service?.prioridade_maxima
      ? 1000
      : (Number(a.service?.prioridade) || 0);
    const prioB = b.service?.prioridade_maxima
      ? 1000
      : (Number(b.service?.prioridade) || 0);
    return prioB - prioA;
  });

  const {
    settings = { horario_inicio: '08:00', horario_fim: '18:00' },
    availabilityRules = null,
    blockedSlots = [],
    activeAppointments = [],
    professionalsBreakTime = {},
    now = new Date(),
  } = options;

  const dayName = format(date, 'EEEE').toLowerCase();
  const dayConfig = availabilityRules ? availabilityRules[dayName] : null;
  if (dayConfig && dayConfig.enabled === false) {
    return { slots: [], audit: { [format(date, 'yyyy-MM-dd')]: ['Estabelecimento fechado neste dia.'] } };
  }

  const startTimeStr = dayConfig?.start || settings.horario_inicio;
  const endTimeStr = dayConfig?.end || settings.horario_fim;
  const [startH, startM] = (startTimeStr || '08:00').split(':').map(Number);
  const [endH, endM] = (endTimeStr || '18:00').split(':').map(Number);

  const bufferTime = Number(settings.buffer_time || 0);
  const slotInterval = Number(settings.slot_interval || 30);

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dateStr = format(date, 'yyyy-MM-dd');

  // ----- 2. Identifica todos os profissionais únicos
  const uniqueProfessionalIds = [
    ...new Set(serviceAssignments.map((a) => normalizeProfId(a.professionalId))),
  ];

  // ----- 3. Constrói o mapa de slots ocupados por profissional
  const professionalBusySlots = {};

  for (const profId of uniqueProfessionalIds) {
    const busy = [];

    // 3a. Slots a partir de agendamentos existentes
    activeAppointments.forEach((app) => {
      const appStart = getSafeDate(app.start_time) || getSafeDate(app.data_hora);
      if (!appStart || appStart < dayStart || appStart > dayEnd) return;
      if (!BLOCKED_STATUSES.includes(app.status)) return;

      const appSlots = getBusySlotsFromAppointment(app);
      appSlots.forEach((slot) => {
        if (slot.profId === profId) busy.push(slot);
      });
    });

    // 3b. Bloqueios manuais do estabelecimento (REGRA 10)
    blockedSlots.forEach((block) => {
      if (block.date !== dateStr) return;
      const [bS, bE] = [block.start_time, block.end_time];
      if (typeof bS !== 'string' || typeof bE !== 'string') return;
      const [bSh, bSm] = bS.split(':').map(Number);
      const [bEh, bEm] = bE.split(':').map(Number);
      if ([bSh, bSm, bEh, bEm].some((n) => isNaN(n))) return;
      const bStart = new Date(date); bStart.setHours(bSh, bSm, 0, 0);
      const bEnd = new Date(date); bEnd.setHours(bEh, bEm, 0, 0);
      busy.push({
        start: bStart, end: bEnd,
        client: 'BLOQUEIO',
        serviceName: block.reason || 'Manual',
      });
    });

    // 3c. Horário de almoço/PAUSA do profissional (REGRA do break_time)
    const breakTime = professionalsBreakTime[profId];
    if (breakTime && breakTime.enabled && breakTime.start && breakTime.end) {
      const [bSh, bSm] = String(breakTime.start).split(':').map(Number);
      const [bEh, bEm] = String(breakTime.end).split(':').map(Number);
      if (![bSh, bSm, bEh, bEm].some((n) => isNaN(n))) {
        const bStart = new Date(date); bStart.setHours(bSh, bSm, 0, 0);
        const bEnd = new Date(date); bEnd.setHours(bEh, bEm, 0, 0);
        busy.push({
          start: bStart, end: bEnd,
          client: 'PAUSA',
          serviceName: 'Horário de Almoço/Pausa',
          isBreak: true,
        });
      }
    }

    // 3d. Horário de almoço/PAUSA GERAL do estabelecimento
    if (dayConfig && dayConfig.break_enabled && dayConfig.break_start && dayConfig.break_end) {
      const [bSh, bSm] = String(dayConfig.break_start).split(':').map(Number);
      const [bEh, bEm] = String(dayConfig.break_end).split(':').map(Number);
      if (![bSh, bSm, bEh, bEm].some((n) => isNaN(n))) {
        const bStart = new Date(date); bStart.setHours(bSh, bSm, 0, 0);
        const bEnd = new Date(date); bEnd.setHours(bEh, bEm, 0, 0);
        busy.push({
          start: bStart, end: bEnd,
          client: 'PAUSA',
          serviceName: 'Intervalo Geral (Almoço)',
          isBreak: true,
        });
      }
    }

    professionalBusySlots[profId] = busy;
  }

  // ----- 4. Simulador sequencial, slot por slot da grade
  let currentCursor = new Date(date);
  currentCursor.setHours(startH, startM, 0, 0);

  const dayLimit = new Date(date);
  dayLimit.setHours(endH, endM, 0, 0);

  while (currentCursor < dayLimit) {
    let isSequenceValid = true;
    let sequenceTimeCursor = new Date(currentCursor);
    const slotLogs = [];
    const slotKey = format(currentCursor, "yyyy-MM-dd'T'HH:mm");

    for (let i = 0; i < sortedAssignments.length; i++) {
      const assignment = sortedAssignments[i];
      const nextAssignment = sortedAssignments[i + 1];

      const profId = normalizeProfId(assignment.professionalId);
      const nextProfId = nextAssignment ? normalizeProfId(nextAssignment.professionalId) : null;

      const serviceDur = Number(assignment.service?.duracao || assignment.service?.duration || 30);
      const slotStart = new Date(sequenceTimeCursor);
      const slotEnd = addMinutes(slotStart, serviceDur);

      // REGRA CRÍTICA: Fechamento do estabelecimento
      if (slotEnd > dayLimit) {
        isSequenceValid = false;
        slotLogs.push(
          `Fim do serviço (${format(slotEnd, 'HH:mm')}) ultrapassa o fechamento (${format(dayLimit, 'HH:mm')}).`
        );
        break;
      }

      const busySlots = professionalBusySlots[profId] || [];
      const isSameProfNext = profId === nextProfId;

      const conflict = busySlots.find((busy) => {
        const isBreak = !!busy.isBreak;
        const effectiveBuffer = (isSameProfNext || isBreak) ? 0 : bufferTime;

        // Intervalos/pausas NÃO geram buffer no fim (são bloqueios fixos).
        const busyEndWithBuffer = isBreak ? busy.end : addMinutes(busy.end, bufferTime);

        // Buffer só no slot candidato se o próximo for profissional DIFERENTE.
        const slotEndWithBuffer = addMinutes(slotEnd, effectiveBuffer);

        // REGRA 8: candidateStart < busyEnd AND candidateEnd > busyStart
        return slotStart < busyEndWithBuffer && slotEnd > busy.start;
      });

      if (conflict) {
        isSequenceValid = false;
        slotLogs.push(
          `Profissional ${profId} ocupado das ${format(conflict.start, 'HH:mm')} às ${format(conflict.end, 'HH:mm')}${conflict.isBreak ? ' (PAUSA)' : ''} por ${conflict.client}.`
        );
        break;
      }

      if (!isAfter(slotStart, now)) {
        isSequenceValid = false;
        slotLogs.push('Horário já passou (slotStart <= "agora").');
        break;
      }

      sequenceTimeCursor = slotEnd;
    }

    if (isSequenceValid) {
      slots.push(new Date(currentCursor));
    } else {
      audit[slotKey] = slotLogs;
    }

    currentCursor = addMinutes(currentCursor, slotInterval);
  }

  return { slots, audit };
}

/**
 * Wrapper compatível para manter o appointmentService.
 */
export function getSlotsSingleService(date, totalDuration, opts, professionalId = null) {
  return calculateAvailableSlotsEngine(
    date,
    [{ service: { duracao: totalDuration, nome: 'Serviço' }, professionalId: normalizeProfId(professionalId) }],
    opts
  ).slots;
}
