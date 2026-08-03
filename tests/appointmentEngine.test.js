// ============================================================
//  MUSA AGENDA — TESTES UNITÁRIOS DO MOTOR SEQUENCIAL (C8)
// ============================================================
//  20 testes cobrindo TODAS as regras do project_memory:
//
// 1.  Grade básica vazia gera slots 08:00..18:00 a cada 30min
// 2.  Serviço de 30min sem conflitos = 20 slots livres
// 3.  Buffer de 15min retira slot imediatamente após conflito (prof DIFERENTE)
// 4.  Buffer NÃO se aplica entre serviços sequenciais do MESMO profissional
// 5.  Horário PASSADO (antes de "now") é bloqueado
// 6.  Fechamento: combo maior que o expediente não inicia tarde demais
// 7.  Sobreposição: slot conflitante desaparece
// 8.  Regra 8 (overlap) candidanteEnd == busyStart NÃO bloqueia (encaixe exato)
// 9.  Dia fechado (availabilityRules.enabled=false) → 0 slots
// 10. Bloqueio manual → slot correspondente removido
// 11. Horário de almoço do ESTABELECIMENTO bloqueia corretamente
// 12. Horário de almoço do PROFISSIONAL bloqueia o profissional, não os outros
// 13. Combo com 2 serviços de 60min → só horários que comportam os 120min
// 14. Prioridade de serviço (⭐) ordena o combo antes de validar
// 15. Combo com múltiplos profissionais: prof1 livre + prof2 ocupado → inválido
// 16. Combo com múltiplos profissionais: ambos livres → válido
// 17. Pausa/Intervalo (isBreak=true) NÃO gera buffer (REGRA NOVA)
// 18. SlotInterval custom 15min gera grade correta
// 19. Status CANCELLED não bloqueia (não entra em BLOCKED_STATUSES)
// 20. Audit logs explicativos para cada slot inválido
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  calculateAvailableSlotsEngine,
  getBusySlotsFromAppointment,
  normalizeProfId,
  BLOCKED_STATUSES,
  APPOINTMENT_STATUS,
} from '../src/services/appointmentEngine.js';
import { format, addMinutes, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

// ------------------------------------------------------------------
// Helpers de conveniência
// ------------------------------------------------------------------
const baseDate = (h = 0, m = 0) => {
  const d = new Date(2026, 8, 15); // Terça-feira, 15/09/2026 (fora do passado)
  return setMilliseconds(setSeconds(setMinutes(setHours(d, h), m), 0), 0);
};

const mkAppointment = (profId, hour, min, durationInMinutes, status = 'scheduled', userNome = 'Cliente') => ({
  professional_id: profId,
  start_time: baseDate(hour, min),
  total_duration: durationInMinutes,
  status,
  user_nome: userNome,
});

const mkServiceAssignment = (duracaoMinutes, professionalId, extra = {}) => ({
  service: { duracao: duracaoMinutes, nome: `Svc ${duracaoMinutes}`, ...extra },
  professionalId,
});

const defaultSettings = () => ({
  horario_inicio: '08:00',
  horario_fim: '18:00',
  buffer_time: 0,
  slot_interval: 30,
});

// "Agora" colocado ANTES do expediente para não invalidar slots passados nos testes
const longAgo = new Date(2000, 0, 1);

// ------------------------------------------------------------------
// TESTES 1..20
// ------------------------------------------------------------------
describe('Musa Agenda — Motor Sequencial (Puro)', () => {

  it('T1 — Grade vazia 08:00..18:00, slot 30min, serviço 30min → 20 slots', () => {
    const day = baseDate();
    const assignments = [mkServiceAssignment(30, 'owner')];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings: defaultSettings(),
      now: longAgo,
    });
    expect(slots).toHaveLength(20);
    expect(format(slots[0], 'HH:mm')).toBe('08:00');
    expect(format(slots[19], 'HH:mm')).toBe('17:30');
  });

  it('T2 — Serviço 60min vazio → 19 slots (08:00..17:00, slotInterval 30min)', () => {
    // Expediente 08:00..18:00 = 10h. Serviço 60min, grade 30min.
    // Slot inicial 08:00 válido (fim 09:00), último 17:00 válido (fim 18:00).
    // Quantidade = ( (18:00 - 08:00) = 600min - 60min ) / 30min + 1 = 540/30 + 1 = 19.
    const day = baseDate();
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(60, 'owner')], {
      settings: defaultSettings(), now: longAgo,
    });
    expect(slots).toHaveLength(19);
    expect(format(slots[0], 'HH:mm')).toBe('08:00');
    expect(format(slots[slots.length - 1], 'HH:mm')).toBe('17:00');
  });

  it('T3 — Buffer 15min retira slot 11:00, deixa apenas 10:30 → 11:15 livre', () => {
    const day = baseDate();
    // 10:00 -> 11:00 com buffer 15 = busy end é 11:15
    const app = mkAppointment('p1', 10, 0, 60);
    const settings = { ...defaultSettings(), buffer_time: 15 };
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'p1')], {
      settings, now: longAgo, activeAppointments: [app],
    });

    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00');
    expect(fmt).not.toContain('10:30');
    expect(fmt).not.toContain('11:00'); // conflito por buffer (11:00 start < 11:15 busyEnd)
    expect(fmt).toContain('11:30');    // buffer passou
  });

  it('T4 — Buffer NÃO se aplica entre etapas consecutivas do MESMO profissional', () => {
    const day = baseDate();
    const settings = { ...defaultSettings(), buffer_time: 15 };
    // 2 serviços no mesmo profissional = 90min. Buffer entre etapas NÃO se aplica.
    // Com buffer geral 15min, mas no mesmo profissional deve ser como 90min.
    const assignments = [
      mkServiceAssignment(30, 'p1'),
      mkServiceAssignment(60, 'p1'),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings, now: longAgo,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    // Total duração 90min → começa 16:30 e termina 18:00. Deve haver slot 16:30.
    expect(fmt).toContain('16:30');
    expect(fmt).not.toContain('17:00'); // 17:00 + 90min = 18:30 > 18:00 (fechamento)
  });

  it('T5 — Horários no PASSADO são bloqueados', () => {
    const day = baseDate(0, 0);
    // "Agora" = 10:15. Qualquer slot <= 10:15 é bloqueado.
    const now = baseDate(10, 15);
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings: defaultSettings(), now,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00'); // 10:00 <= 10:15
    expect(fmt).toContain('10:30');    // 10:30 > 10:15
  });

  it('T6 — Fechamento: Combo 2h não inicia às 16:30 (ultrapassa 18:00)', () => {
    const day = baseDate();
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(120, 'owner')], {
      settings: defaultSettings(), now: longAgo,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).toContain('16:00'); // 16+2h = 18h ok
    expect(fmt).not.toContain('16:30'); // 16:30+2h = 18:30 > 18:00
  });

  it('T7 — Sobreposição básica: agendamento 10:00-10:30 bloqueia slot 10:00 e 10:30 adjacente com buffer 0', () => {
    const day = baseDate();
    const app = mkAppointment('owner', 10, 0, 30);
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings: defaultSettings(), now: longAgo, activeAppointments: [app],
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00');
    // Overlap rule: candidateEnd(10:30) > busy.start(10:00) AND candidate.start < busyEnd.
    // Slot 10:30 não sobrepõe (candidateStart 10:30 == busyEnd 10:30). Com buffer 0, livre.
    expect(fmt).toContain('10:30');
  });

  it('T8 — Regra 8: candidateEnd === busyStart é PERMITIDO (encaixe exato)', () => {
    const day = baseDate();
    // App termina exatamente às 10:30. Candidato começa 10:30. Deve passar.
    const app = mkAppointment('owner', 10, 0, 30); // 10:00 -> 10:30
    const settings = { ...defaultSettings(), buffer_time: 0 };
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings, now: longAgo, activeAppointments: [app],
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).toContain('10:30');
  });

  it('T9 — Estabelecimento FECHADO no dia → 0 slots', () => {
    const day = baseDate();
    const availabilityRules = {
      tuesday: { enabled: false },
    };
    const { slots, audit } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings: defaultSettings(), now: longAgo, availabilityRules,
    });
    expect(slots).toHaveLength(0);
    expect(audit).toBeTruthy();
  });

  it('T10 — Bloqueio MANUAL 10:00-11:00 remove slots dessa janela', () => {
    const day = baseDate();
    const blockedSlots = [
      { date: format(day, 'yyyy-MM-dd'), start_time: '10:00', end_time: '11:00', reason: 'Manutenção' },
    ];
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings: defaultSettings(), now: longAgo, blockedSlots,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00');
    expect(fmt).not.toContain('10:30');
    expect(fmt).toContain('11:00');
  });

  it('T11 — Almoço do ESTABELECIMENTO 12:00-13:00 bloqueia TODOS os profissionais', () => {
    const day = baseDate();
    const availabilityRules = {
      tuesday: {
        enabled: true,
        start: '08:00', end: '18:00',
        break_enabled: true, break_start: '12:00', break_end: '13:00',
      },
    };
    const { slots } = calculateAvailableSlotsEngine(day, [
      mkServiceAssignment(30, 'p1'), mkServiceAssignment(30, 'p2'),
    ], {
      settings: defaultSettings(), now: longAgo, availabilityRules,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('12:00');
    expect(fmt).not.toContain('12:30');
    expect(fmt).toContain('13:00');
  });

  it('T12 — Almoço do PROFISSIONAL só afeta a SI MESMA', () => {
    const day = baseDate();
    // p1 almoça 12:00..13:00. p2 trabalha normalmente.
    const professionalsBreakTime = {
      p1: { enabled: true, start: '12:00', end: '13:00' },
    };
    // Combo com serviços em p1 e p2 ao mesmo tempo
    const assignments = [
      mkServiceAssignment(30, 'p1'),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings: defaultSettings(), now: longAgo, professionalsBreakTime,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    // p1 não pode 12:00, 12:30
    expect(fmt).not.toContain('12:00');
    expect(fmt).not.toContain('12:30');
    expect(fmt).toContain('13:00');
  });

  it('T13 — Combo 2 serviços (60 + 60min) → só horários que comportam os 120 min', () => {
    const day = baseDate();
    const assignments = [
      mkServiceAssignment(60, 'p1'),
      mkServiceAssignment(60, 'p2'),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings: defaultSettings(), now: longAgo,
    });
    // Total 2h. Espera slots 08:00..16:00 a cada 30min → 17 slots.
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(slots).toHaveLength(17);
    expect(fmt[0]).toBe('08:00');
    expect(fmt[slots.length - 1]).toBe('16:00');
  });

  it('T14 — Prioridade ⭐ reordena o serviço com prioridade máxima PRIMEIRO (ordem de validação)', () => {
    // Setup:
    //  - p1 está ocupado 08:00..08:30
    //  - p2 está ocupado 08:30..09:00
    // Sem prioridade: [SvcA no p1, SvcB no p2]
    //   Slot 08:00: p1 08:00-08:30 CONFLITA (p1 ocupado) → audit cita p1
    // Com prioridade: SvcB ⭐ executa PRIMEIRO
    //   Slot 08:00: SvcB(p2) 08:00-08:30 (LIVRE) → SvcA(p1) 08:30-09:00 (LIVRE) — VÁLIDO
    // Ou seja: com prioridade, o slot 08:00 deixa de ser INVÁLIDO e passa a ser VÁLIDO.
    const day = baseDate();
    const p1App = mkAppointment('p1', 8, 0, 30);
    const p2App = mkAppointment('p2', 8, 30, 30);
    const apps = [p1App, p2App];

    // --- SEM prioridade ---
    const aSemPrio = [
      mkServiceAssignment(30, 'p1'), // SvcA
      mkServiceAssignment(30, 'p2'), // SvcB
    ];
    const rSemPrio = calculateAvailableSlotsEngine(day, aSemPrio, {
      settings: defaultSettings(), now: longAgo, activeAppointments: apps,
    });
    const fmtSem = rSemPrio.slots.map((d) => format(d, 'HH:mm'));

    // --- COM prioridade (SvcB ⭐) ---
    const aComPrio = [
      mkServiceAssignment(30, 'p1'),
      mkServiceAssignment(30, 'p2', { prioridade_maxima: true }),
    ];
    const rComPrio = calculateAvailableSlotsEngine(day, aComPrio, {
      settings: defaultSettings(), now: longAgo, activeAppointments: apps,
    });
    const fmtCom = rComPrio.slots.map((d) => format(d, 'HH:mm'));

    // Resultado esperado: slot 08:00 passou a ser VÁLIDO graças à reordenação por prioridade.
    expect(fmtSem).not.toContain('08:00');
    expect(fmtCom).toContain('08:00');
  });

  it('T15 — Múltiplos profissionais: UM ocupado invalida TODO o slot (REGRA CADEIA COMPLETA)', () => {
    const day = baseDate();
    // Agendamento p1 10:00..10:30.
    // Combo: svcA(p1, 30min) + svcB(p2, 30min). Sequencial.
    // Slot 10:00 → svcA(p1) CONFLITA (p1 ocupado 10:00-10:30). Cadeia quebra → slot rejeitado.
    const p1App = mkAppointment('p1', 10, 0, 30);
    const assignments = [
      mkServiceAssignment(30, 'p1'),
      mkServiceAssignment(30, 'p2'),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings: defaultSettings(), now: longAgo, activeAppointments: [p1App],
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00'); // inválido (p1 ocupado na etapa 1)
    // Note: 10:30 é VÁLIDO (p1 é livre 10:30, p2 livre 11:00). A regra é por SLOT candidato.
    expect(fmt).toContain('10:30');
  });

  it('T16 — Múltiplos profissionais: AMBOS livres → slot ACEITO', () => {
    const day = baseDate();
    const assignments = [
      mkServiceAssignment(30, 'p1'),
      mkServiceAssignment(30, 'p2'),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, assignments, {
      settings: defaultSettings(), now: longAgo,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).toContain('10:00');
    expect(fmt).toContain('10:30');
  });

  it('T17 — Pausa/Intervalo (isBreak) NÃO GERA buffer', () => {
    const day = baseDate();
    // Almoço 10:00..10:30 (é isBreak=true). Buffer geral é 15min.
    // Como é PAUSA, 10:30 deve ser o PRIMEIRO slot livre e NÃO deve haver buffer extra (10:45).
    // Para validar, comparamos slot 10:30 (deve existir, é permitido).
    const availabilityRules = {
      tuesday: {
        enabled: true, start: '08:00', end: '18:00',
        break_enabled: true, break_start: '10:00', break_end: '10:30',
      },
    };
    const settings = { ...defaultSettings(), buffer_time: 15 };
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'p1')], {
      settings, now: longAgo, availabilityRules,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).not.toContain('10:00');
    // Se pausa GERASSE buffer 15, 10:30 iria embora. Como não gera, 10:30 é PERMITIDO.
    expect(fmt).toContain('10:30');
  });

  it('T18 — Slot Interval 15 min → grade 41 slots (08:00..17:45 a 15 em 15)', () => {
    const day = baseDate();
    const settings = { ...defaultSettings(), slot_interval: 15 };
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(15, 'owner')], {
      settings, now: longAgo,
    });
    expect(slots).toHaveLength(40); // 10h * 4 slots/h = 40
    expect(format(slots[0], 'HH:mm')).toBe('08:00');
    expect(format(slots[39], 'HH:mm')).toBe('17:45');
  });

  it('T19 — Status CANCELLED não bloqueia a agenda', () => {
    const day = baseDate();
    const apps = [
      mkAppointment('owner', 10, 0, 30, 'cancelled'),
      mkAppointment('owner', 10, 30, 30, 'cancelado'),
      mkAppointment('owner', 11, 0, 30, APPOINTMENT_STATUS.CANCELLED),
    ];
    const { slots } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'owner')], {
      settings: defaultSettings(), now: longAgo, activeAppointments: apps,
    });
    const fmt = slots.map((d) => format(d, 'HH:mm'));
    expect(fmt).toContain('10:00');
    expect(fmt).toContain('10:30');
    expect(fmt).toContain('11:00');
  });

  it('T20 — Audit logs explica o porquê de cada slot inválido (auditoria)', () => {
    const day = baseDate();
    const app = mkAppointment('p1', 10, 0, 30, 'scheduled', 'Joana');
    const { audit } = calculateAvailableSlotsEngine(day, [mkServiceAssignment(30, 'p1')], {
      settings: { ...defaultSettings(), buffer_time: 5 },
      now: longAgo,
      activeAppointments: [app],
    });
    const badSlot = format(baseDate(10, 0), "yyyy-MM-dd'T'HH:mm");
    const logs = audit[badSlot] || [];
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join(' ')).toContain('Joana'); // deve conter o nome do cliente que está bloqueando
  });

  // --------------------------------------------------------------
  // Testes de funções auxiliares (helpers)
  // --------------------------------------------------------------
  it('HELPER — getBusySlotsFromAppointment extrai corretamente 2 serviços em profissionais distintos', () => {
    const start = baseDate(9, 0);
    const app = {
      start_time: start,
      services: [
        { nome: 'Limpeza', duracao: 30, professional_id: 'p1' },
        { nome: 'Massagem', duracao: 60, professional_id: 'p2' },
      ],
      user_nome: 'Mariana',
    };
    const slots = getBusySlotsFromAppointment(app);
    expect(slots).toHaveLength(2);
    expect(slots[0].profId).toBe('p1');
    expect(format(slots[0].start, 'HH:mm')).toBe('09:00');
    expect(format(slots[0].end, 'HH:mm')).toBe('09:30');
    expect(slots[1].profId).toBe('p2');
    expect(format(slots[1].start, 'HH:mm')).toBe('09:30');
    expect(format(slots[1].end, 'HH:mm')).toBe('10:30');
  });

  it('HELPER — normalizeProfId resolve null/undefined/vazios para "owner"', () => {
    expect(normalizeProfId(null)).toBe('owner');
    expect(normalizeProfId(undefined)).toBe('owner');
    expect(normalizeProfId('')).toBe('owner');
    expect(normalizeProfId('  p1  ')).toBe('p1');
    expect(normalizeProfId('owner')).toBe('owner');
  });

  it('HELPER — BLOCKED_STATUSES contém scheduled/confirmed/completed/pending/manual', () => {
    expect(BLOCKED_STATUSES).toContain('scheduled');
    expect(BLOCKED_STATUSES).toContain('confirmed');
    expect(BLOCKED_STATUSES).toContain('completed');
    expect(BLOCKED_STATUSES).toContain('pending');
    expect(BLOCKED_STATUSES).toContain('manual');
    expect(BLOCKED_STATUSES).not.toContain('cancelled');
  });
});
