import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown, Zap, Sparkles, Check, ArrowRight, CreditCard, AlertCircle } from 'lucide-react';
import { subscriptionService } from '../../../services/subscriptionService';

const SubscriptionGuard = ({ establishment, setView, children }) => {
  const status = subscriptionService.checkSubscriptionStatus(establishment);

  if (status.active) {
    // Se estiver em trial, mostramos um banner discreto no topo (opcional, lidaremos no Dashboard)
    return children;
  }

  const PLANS = [
    {
      id: 'bronze',
      name: 'Essencial',
      price: '19,99',
      icon: Zap,
      color: 'blue',
      features: ['Até 100 agendamentos/mês', 'Gestão de Clientes', 'WhatsApp Flutuante', 'Suporte via Chat']
    },
    {
      id: 'silver',
      name: 'Profissional',
      price: '29,99',
      icon: Crown,
      color: 'pink',
      popular: true,
      features: ['Agendamentos Ilimitados', 'Relatórios Financeiros', 'Personalização Completa', 'Suporte Prioritário']
    },
    {
      id: 'gold',
      name: 'Premium VIP',
      price: '44,99',
      icon: Sparkles,
      color: 'amber',
      features: ['Tudo do Profissional', 'Multiprofissionais', 'Estatísticas Avançadas', 'Treinamento VIP']
    }
  ];

  const getReasonMessage = () => {
    switch (status.reason) {
      case 'trial_expired':
        return 'Seu período de teste gratuito de 15 dias chegou ao fim.';
      case 'expired':
        return 'Sua assinatura mensal expirou.';
      case 'past_due':
        return 'Houve um problema com seu último pagamento.';
      default:
        return 'Sua conta precisa de uma assinatura ativa para continuar.';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-6xl w-full bg-gray-50 rounded-[3rem] shadow-2xl overflow-hidden my-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Lado Esquerdo: Mensagem e Planos */}
          <div className="lg:col-span-12 p-8 lg:p-12">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-full text-xs font-black uppercase tracking-widest mb-6">
                <AlertCircle size={14} />
                Acesso Bloqueado
              </div>
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight mb-4">
                Hora de dar o próximo passo! 🚀
              </h2>
              <p className="text-xl text-gray-500 font-medium">
                {getReasonMessage()} Escolha o plano que melhor se adapta ao seu negócio e continue crescendo com o Musa Agenda.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map(plan => (
                <div 
                  key={plan.id}
                  className={`relative bg-white rounded-[2.5rem] p-8 border-2 transition-all hover:shadow-xl ${
                    plan.popular ? 'border-pink-600 shadow-lg shadow-pink-100 scale-105 z-10' : 'border-gray-100'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Recomendado
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      plan.color === 'pink' ? 'bg-pink-50 text-pink-600' : 
                      plan.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      <plan.icon size={32} />
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-gray-900">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-sm font-bold text-gray-400">R$</span>
                        <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-sm font-bold text-gray-400">/mês</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {plan.features.map(feature => (
                        <div key={feature} className="flex items-center gap-3">
                          <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Check size={12} strokeWidth={4} />
                          </div>
                          <span className="text-sm font-bold text-gray-600 text-left">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setView('assinatura')}
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        plan.popular ? 'bg-pink-600 text-white shadow-lg shadow-pink-200 hover:bg-pink-700' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      Assinar Plano <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-gray-400 text-sm font-medium flex items-center justify-center gap-2">
                <CreditCard size={16} /> Pagamento processado com segurança pelo Mercado Pago
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionGuard;
