import { db, callFunction } from './firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

/**
 * Serviço para gerenciar assinaturas e pagamentos via Mercado Pago
 */

const DEFAULT_SUBSCRIPTION_API_URL = 'https://us-central1-estetica-f543c.cloudfunctions.net/createSubscriptionPreference';
const SUBSCRIPTION_API_URL =
  import.meta.env.VITE_SUBSCRIPTION_API_URL || DEFAULT_SUBSCRIPTION_API_URL;

export const subscriptionService = {
  // Configurações dos Planos (Sincronizado com AdminDashboard)
  PLANS: {
    bronze: {
      id: 'bronze',
      name: 'Essencial',
      price: 19.99,
      limit: 100
    },
    silver: {
      id: 'silver',
      name: 'Profissional',
      price: 29.99,
      limit: Infinity
    },
    gold: {
      id: 'gold',
      name: 'Premium VIP',
      price: 44.99,
      limit: Infinity
    }
  },

  /**
   * Verifica se a assinatura do estabelecimento é válida
   */
  checkSubscriptionStatus(establishment) {
    if (!establishment) return { active: false, reason: 'no_establishment' };
    
    const sub = establishment.subscription;
    if (!sub) return { active: false, reason: 'no_subscription' };

    const now = new Date();

    // 1. Verificar Trial
    if (sub.status === 'trial') {
      const trialEnd = sub.trial_ends_at?.toDate ? sub.trial_ends_at.toDate() : new Date(sub.trial_ends_at);
      if (trialEnd > now) {
        return { 
          active: true, 
          status: 'trial', 
          daysRemaining: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) 
        };
      }
      return { active: false, reason: 'trial_expired' };
    }

    // 2. Verificar Assinatura Ativa ou Cancelada (mas ainda no prazo)
    if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'cancelled') {
      // Mesmo ativa ou cancelada, verificamos se o período não expirou (segurança extra)
      if (sub.current_period_end) {
        const periodEnd = sub.current_period_end?.toDate ? sub.current_period_end.toDate() : new Date(sub.current_period_end);
        if (periodEnd < now) {
          return { active: false, reason: 'expired' };
        }
      }
      
      // Se o status for 'cancelled', mas passou na checagem de data acima, 
      // retornamos active: true para garantir o acesso até o fim.
      return { 
        active: true, 
        status: sub.status,
        isCancelled: sub.status === 'cancelled'
      };
    }

    // 3. Caso contrário, inativa
    return { active: false, reason: sub.status || 'inactive' };
  },

  /**
   * Gera a URL de pagamento do Mercado Pago (Checkout Pro)
   */
  async createPaymentPreference(establishment, planId, customerEmail) {
    const plan = this.PLANS[planId];
    if (!plan) throw new Error("Plano inválido");

    try {
      const response = await fetch(SUBSCRIPTION_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          establishmentId: establishment.id, 
          planId: planId,
          customerEmail: customerEmail,
          origin: window.location.origin // Envia a URL atual (localhost ou domínio real)
        })
      });

      if (!response.ok) {
        let errorMsg = `Erro ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
          errorMsg = await response.text();
        }
        
        console.error("Erro detalhado da API:", errorMsg);
        throw new Error(errorMsg);
      }

      const payload = await response.json();

      if (!payload?.init_point) {
        throw new Error("A API de pagamento não retornou um link válido.");
      }

      return payload;
    } catch (error) {
      console.error("Erro ao criar preferência:", error);
      throw new Error(error.message || "Não foi possível iniciar o pagamento.");
    }
  },

  /**
   * Atualiza o status da assinatura (Chamado via Webhook no backend em produção)
   */
  async activateSubscription(establishmentId, planId) {
    const estRef = doc(db, 'establishments', establishmentId);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await updateDoc(estRef, {
      'subscription.status': 'active',
      'subscription.plan': planId,
      'subscription.current_period_start': Timestamp.fromDate(now),
      'subscription.current_period_end': Timestamp.fromDate(nextMonth),
      'subscription.last_payment_at': Timestamp.fromDate(now),
      'plan': planId // Atualiza o campo principal para compatibilidade
    });
  },

  /**
   * Cancela a assinatura atual (Mantém acesso até o fim do período pago)
   * ✅ SEGURANÇA: Não pode ser client-side devido a regra firestore.rules `subscriptionFieldsUnchanged()`.
   *             Delega para Cloud Function onCall `cancelSubscriptionCallable` (Admin SDK).
   */
  async cancelSubscription(establishmentId) {
    const resp = await callFunction('cancelSubscriptionCallable', { establishmentId });
    if (!resp?.data?.ok) {
      throw new Error((resp?.data?.message) || "Falha ao cancelar assinatura.");
    }
    return resp.data;
  }
};
