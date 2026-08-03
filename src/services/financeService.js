import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp,
  orderBy,
  getDoc
} from "firebase/firestore";

export const recordAppointmentTransaction = async (appointment, establishmentIdOverride = null, paymentMethod = 'pix') => {
  try {
    console.log("Iniciando registro de transação financeira para o agendamento:", appointment.id);
    
    const { 
      id: appointmentId, 
      establishment_id, 
      services, 
      total_price, 
      professional_id, 
      professional_nome,
      user_id,
      user_nome,
      preco,
      totalPrice // Adicionado fallback camelCase
    } = appointment;

    const finalEstablishmentId = establishmentIdOverride || establishment_id;
    
    // Função auxiliar para extrair números de qualquer campo
    const getNum = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = String(val).replace(/[^\d.,]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    const fallbackPrice = getNum(total_price || preco || totalPrice || 0);
    
    if (!finalEstablishmentId) {
      console.error("ERRO CRÍTICO: establishment_id não encontrado no agendamento nem no override.");
      throw new Error("Não é possível registrar transação sem ID do estabelecimento.");
    }

    // Função auxiliar para salvar transação individual
    const saveTransaction = async (data) => {
      console.log("Salvando documento de transação no Firestore:", data);
      return addDoc(collection(db, "transactions"), data);
    };

    // Se for um combo com múltiplos serviços/profissionais
    if (services && Array.isArray(services) && services.length > 0) {
      console.log(`Registrando combo com ${services.length} serviços.`);
      const transactionPromises = services.map(async (service, index) => {
        const profId = service.professional_id || professional_id || 'owner';
        const profNome = service.professional_nome || professional_nome || 'Especialista Principal';
        
        let commissionPercentage = 0;
        try {
          if (profId !== 'owner') {
            const profDoc = await getDoc(doc(db, "professionals", profId));
            if (profDoc.exists()) {
              commissionPercentage = getNum(profDoc.data().commission_percentage || 0);
            }
          } else {
            const estDoc = await getDoc(doc(db, "establishments", finalEstablishmentId));
            if (estDoc.exists()) {
              commissionPercentage = getNum(estDoc.data().settings?.owner_commission || 0);
            }
          }
        } catch (err) {
          console.warn(`Erro ao buscar comissão para prof ${profId}, usando 0:`, err);
        }

        const servicePrice = getNum(service.preco || service.price || (services.length === 1 ? fallbackPrice : 0) || 0);
        const commissionValue = Number(((servicePrice * commissionPercentage) / 100).toFixed(2));

        return saveTransaction({
          appointment_id: String(appointmentId || 'manual'),
          establishment_id: String(finalEstablishmentId),
          user_id: String(user_id || 'guest'),
          user_nome: String(user_nome || 'Cliente não identificado'),
          service_id: String(service.id || service.service_id || 'manual'),
          service_nome: String(service.nome || service.service_nome || 'Serviço'),
          total_value: servicePrice,
          professional_id: String(profId),
          professional_nome: String(profNome),
          commission_percentage: commissionPercentage,
          commission_value: commissionValue,
          net_value: Number((servicePrice - commissionValue).toFixed(2)),
          status: 'pending',
          payment_method: paymentMethod, // Novo campo
          date: appointment.data_hora || Timestamp.now(),
          createdAt: Timestamp.now(),
          type: 'service',
          index: index // Para distinguir serviços no mesmo agendamento
        });
      });

      await Promise.all(transactionPromises);
    } else {
      // Agendamento simples
      console.log("Registrando agendamento simples.");
      const profId = professional_id || 'owner';
      let commissionPercentage = 0;
      
      try {
        if (profId !== 'owner') {
          const profDoc = await getDoc(doc(db, "professionals", profId));
          if (profDoc.exists()) {
            commissionPercentage = getNum(profDoc.data().commission_percentage || 0);
          }
        }
      } catch (err) {
        console.warn(`Erro ao buscar comissão para prof ${profId}, usando 0:`, err);
      }

      const totalValue = fallbackPrice;
      const commissionValue = Number(((totalValue * commissionPercentage) / 100).toFixed(2));

      await saveTransaction({
        appointment_id: String(appointmentId || 'manual'),
        establishment_id: String(finalEstablishmentId),
        user_id: String(user_id || 'guest'),
        user_nome: String(user_nome || 'Cliente não identificado'),
        service_id: String(appointment.service_id || 'manual'),
        service_nome: String(appointment.service_nome || appointment.serviceName || 'Serviço Manual'),
        total_value: totalValue,
        professional_id: String(profId),
        professional_nome: String(professional_nome || 'Especialista Principal'),
        commission_percentage: commissionPercentage,
        commission_value: commissionValue,
        net_value: Number((totalValue - commissionValue).toFixed(2)),
        status: 'pending',
        payment_method: paymentMethod, // Novo campo
        date: appointment.data_hora || Timestamp.now(),
        createdAt: Timestamp.now(),
        type: 'service'
      });
    }

    console.log("Todas as transações registradas com sucesso para o agendamento:", appointmentId);
    return { success: true };
  } catch (error) {
    console.error("ERRO AO REGISTRAR TRANSAÇÃO NO FINANCEIRO:", error);
    throw error;
  }
};

/**
 * Busca todas as transações de um estabelecimento em um período.
 */
export const getTransactions = async (establishmentId, startDate, endDate) => {
  try {
    console.log("Buscando transações para:", establishmentId);

    // C6: Filtro de data DIRETO NA QUERY (não mais full-scan de todo o histórico).
    // Usa 'createdAt' que é o campo padrão de lançamento no financeiro.
    // Filtro em memória abaixo é mantido apenas como fallback de compatibilidade.
    let q = query(
      collection(db, "transactions"),
      where("establishment_id", "==", establishmentId),
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      where("createdAt", "<=", Timestamp.fromDate(endDate))
    );

    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (queryError) {
      // Fallback: se o índice composto ainda não foi criado,
      // tentamos a query sem o filtro de data (apenas para não quebrar a view)
      if (queryError.code === 'failed-precondition') {
        console.warn(
          "[financeService] Índice composto (establishment_id + createdAt) ainda não criado. " +
          "Usando fallback (sem filtro na query). Execute: firebase deploy --only firestore:indexes"
        );
        q = query(
          collection(db, "transactions"),
          where("establishment_id", "==", establishmentId)
        );
        snapshot = await getDocs(q);
      } else {
        throw queryError;
      }
    }

    console.log(`Total de transações encontradas no banco para esta estética: ${snapshot.size}`);
    
    let transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 1. Filtro de data manual (em memória)
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    console.log(`Filtrando entre ${startDate.toLocaleString()} e ${endDate.toLocaleString()}`);

    const filtered = transactions.filter(t => {
      // Preferimos createdAt (data de lançamento no financeiro). Fallback para date.
      const rawDate = t.createdAt || t.date;

      let transDate;
      if (rawDate?.toDate) {
        transDate = rawDate.toDate();
      } else if (rawDate?.seconds) {
        transDate = new Date(rawDate.seconds * 1000);
      } else {
        transDate = new Date(rawDate);
      }
      
      const transMs = transDate.getTime();
      const isMatch = transMs >= startMs && transMs <= endMs;
      return isMatch;
    });

    console.log(`Transações após filtro de data: ${filtered.length}`);

    // 2. Ordenação manual em memória (mais recente primeiro)
    filtered.sort((a, b) => {
      const getTime = (val) => {
        if (val?.toMillis) return val.toMillis();
        if (val?.seconds) return val.seconds * 1000;
        return new Date(val).getTime();
      };
      return getTime(b.createdAt || b.date) - getTime(a.createdAt || a.date);
    });

    return filtered;
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    throw error;
  }
};

/**
 * Marca uma comissão como paga.
 */
export const markCommissionAsPaid = async (transactionId) => {
  try {
    const ref = doc(db, "transactions", transactionId);
    await updateDoc(ref, { 
      status: 'paid',
      paidAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Erro ao pagar comissão:", error);
    throw error;
  }
};
