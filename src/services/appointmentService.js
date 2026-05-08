import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp, 
  orderBy, 
  doc, 
  updateDoc,
  getDoc
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
import { enUS } from 'date-fns/locale';

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
 * Calcula horários disponíveis para um ou múltiplos serviços em um estabelecimento
 */
export const getAvailableSlots = async (date, totalDuration, establishmentId) => {
  if (!establishmentId) return [];
  
  try {
    const establishmentRef = doc(db, 'establishments', establishmentId);
    const establishmentSnap = await getDoc(establishmentRef);
    
    if (!establishmentSnap.exists()) return [];
    
    const establishment = establishmentSnap.data();
    const settings = establishment.settings || { horario_inicio: "08:00", horario_fim: "18:00" };
    const availabilityRules = establishment.availability_rules || null;
    const blockedSlots = establishment.blocked_slots || [];
    const bufferTime = settings.buffer_time || 0;
    
    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase(); // Ex: 'monday'
    const dayConfig = availabilityRules ? availabilityRules[dayName] : null;

    // Se o dia não estiver habilitado na regra semanal, não há horários
    if (dayConfig && !dayConfig.enabled) return [];

    const startTimeStr = dayConfig ? dayConfig.start : settings.horario_inicio;
    const endTimeStr = dayConfig ? dayConfig.end : settings.horario_fim;

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Filtramos agendamentos ativos do estabelecimento
    const q = query(
      collection(db, "appointments"),
      where("establishment_id", "==", establishmentId)
    );
    
    const querySnapshot = await getDocs(q);
    const busySlots = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(app => app.status === 'ativo' || app.status === 'scheduled')
      .map(data => {
        const start = data.start_time ? data.start_time.toDate() : data.data_hora.toDate();
        const end = data.end_time ? data.end_time.toDate() : addMinutes(start, data.duration || 30);
        return { start, end };
      })
      .filter(busy => busy.start >= dayStart && busy.start <= dayEnd);

    // Adicionamos os bloqueios manuais aos busySlots
    blockedSlots.forEach(block => {
      if (block.date === dateStr) {
        const [bStartH, bStartM] = block.start_time.split(':').map(Number);
        const [bEndH, bEndM] = block.end_time.split(':').map(Number);
        
        const bStart = new Date(date);
        bStart.setHours(bStartH, bStartM, 0, 0);
        
        const bEnd = new Date(date);
        bEnd.setHours(bEndH, bEndM, 0, 0);
        
        busySlots.push({ start: bStart, end: bEnd });
      }
    });

    let slots = [];
    let current = new Date(date);
    current.setHours(startH, startM, 0, 0);
    
    const limit = new Date(date);
    limit.setHours(endH, endM, 0, 0);

    const now = new Date();

    while (current < limit) {
      const slotStart = new Date(current);
      const slotEnd = addMinutes(slotStart, totalDuration);

      if (slotEnd > limit) break;

      const isBusy = busySlots.some(busy => {
        const busyEndWithBuffer = addMinutes(busy.end, bufferTime);
        return slotStart < busyEndWithBuffer && slotEnd > busy.start;
      });

      if (!isBusy && isAfter(slotStart, now)) {
        slots.push(slotStart);
      }
      
      current = addMinutes(current, 30);
    }

    return slots;
  } catch (error) {
    console.error("Erro ao calcular horários:", error);
    return [];
  }
};

/**
 * Cria um novo agendamento profissional com múltiplos serviços
 */
export const createAppointment = async (appointmentData) => {
  try {
    if (!appointmentData.establishment_id) throw new Error("ID do estabelecimento é obrigatório");
    
    const { 
      data_hora, 
      duration, 
      services, 
      total_duration, 
      total_price,
      ...rest 
    } = appointmentData;

    // Se vier no formato novo usa, senão usa o antigo (compatibilidade)
    const start = data_hora;
    const dur = total_duration || duration || 30;
    const end = addMinutes(start, dur);

    const docRef = await addDoc(collection(db, "appointments"), {
      ...rest,
      services: services || [],
      total_duration: dur,
      total_price: total_price || rest.preco || 0,
      start_time: Timestamp.fromDate(start),
      end_time: Timestamp.fromDate(end),
      // Mantendo data_hora e duration para compatibilidade com partes antigas do sistema
      data_hora: Timestamp.fromDate(start),
      duration: dur,
      status: 'scheduled',
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    throw error;
  }
};

/**
 * Busca agendamentos de um usuário em todos os estabelecimentos
 * Ou pode ser filtrado por estabelecimento se necessário
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
      .sort((a, b) => b.data_hora.toDate() - a.data_hora.toDate());
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
    return await updateDoc(ref, { status: 'cancelled' });
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    throw error;
  }
};
