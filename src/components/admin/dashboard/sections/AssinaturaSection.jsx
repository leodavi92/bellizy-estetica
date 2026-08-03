import React from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Info, CheckCircle, Check, Crown, CreditCard, AlertTriangle } from 'lucide-react';
import { subscriptionService } from '../../../../services/subscriptionService';

const safeToDate = (dateObj) => {
  if (!dateObj) return new Date();
  if (dateObj.toDate) return dateObj.toDate();
  return new Date(dateObj);
};

const AssinaturaSection = ({
  view,
  hasActiveSubscription,
  currentPlan,
  currentPlanName,
  establishment,
  setView,
  setIsCancelSubscriptionModalOpen,
  monthlyPlanLimit,
  monthlyAppointmentsCount,
  usagePercent,
  recommendedUpgrade,
  PLANS,
  userPlan,
  user,
  showToast,
}) => {
  // View: Detalhes da Assinatura
  if (view === 'assinatura' && hasActiveSubscription) {
    const subStatus = establishment?.subscription?.status;
    const periodoEnd = establishment?.subscription?.current_period_end;
    const trialEndsAt = establishment?.subscription?.trial_ends_at;
    const isCancelled = subStatus === 'cancelled';
    const isActive = subStatus === 'active';
    const statusLabel = isActive ? 'Ativo' : isCancelled ? 'Cancelado' : 'Em Teste';
    const statusClass = isActive
      ? 'bg-emerald-100 text-emerald-600'
      : isCancelled
        ? 'bg-red-100 text-red-600'
        : 'bg-amber-100 text-amber-600';

    const prazoLabel = isActive
      ? `Sua assinatura renova em ${format(safeToDate(periodoEnd), "dd 'de' MMMM", { locale: ptBR })}`
      : isCancelled
        ? `Seu acesso será encerrado em ${format(safeToDate(periodoEnd), "dd 'de' MMMM", { locale: ptBR })}. Após essa data, sua conta voltará para o plano básico.`
        : `Seu período de teste termina em ${format(safeToDate(trialEndsAt), "dd 'de' MMMM", { locale: ptBR })}`;

    const prazoCurto = isActive
      ? `Renova em ${format(safeToDate(periodoEnd), "dd 'de' MMM", { locale: ptBR })}`
      : isCancelled
        ? `Vence em ${format(safeToDate(periodoEnd), "dd 'de' MMM", { locale: ptBR })}`
        : `Termina em ${format(safeToDate(trialEndsAt), "dd 'de' MMM", { locale: ptBR })}`;

    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 flex flex-col md:flex-row md:items-start gap-4 shadow-sm">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              Informação Importante sobre Renovação
            </p>
            <p className="text-sm font-bold text-amber-900">
              A renovação atual é realizada via pagamento mensal manual (Checkout Mercado Pago).
            </p>
            <p className="text-xs font-bold text-amber-800/80">
              O débito automático (assinatura recorrente real do cartão) está na fase final de integração
              e será liberado nas próximas atualizações sem custo adicional.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-pink-100 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-600">
                Detalhes da Assinatura
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                  Plano atual: {currentPlanName}
                </h3>
                <span className={`w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-gray-500 font-medium max-w-2xl">
                {isCancelled
                  ? 'Sua assinatura foi cancelada. Você ainda pode usar todos os recursos até o final do período pago.'
                  : 'Aqui voce acompanha status, uso do plano, limite mensal e as opcoes de upgrade em um lugar so.'}
              </p>
              <p className={`text-sm font-bold ${isCancelled ? 'text-red-600' : 'text-gray-500'}`}>
                {prazoLabel}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              {isActive && (() => {
                const diasParaVencer = Math.max(0, differenceInCalendarDays(safeToDate(periodoEnd), new Date()));
                const podeRenovar = diasParaVencer <= 20;
                return (
                  <button
                    onClick={() => setView('planos_assinatura')}
                    className="px-6 py-3 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-pink-700 transition-all active:scale-95 shadow-lg shadow-pink-100"
                  >
                    {podeRenovar ? 'Renovar / Pagar Agora' : 'Ver Planos'}
                  </button>
                );
              })()}

              {!isActive && (
                <button
                  onClick={() => setView('planos_assinatura')}
                  className="px-6 py-3 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-pink-700 transition-all active:scale-95 shadow-lg shadow-pink-100"
                >
                  Ver Planos
                </button>
              )}

              {isActive && (
                <button
                  onClick={() => setIsCancelSubscriptionModalOpen(true)}
                  className="px-6 py-3 rounded-2xl text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all border border-gray-200"
                >
                  Cancelar Assinatura
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-[2rem] border border-pink-100 bg-pink-50/50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-600">Plano Atual</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white text-pink-600 flex items-center justify-center shadow-sm">
                  {currentPlan.icon && React.createElement(currentPlan.icon, { size: 22 })}
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">{currentPlanName}</p>
                  <p className="text-xs font-bold text-gray-500">Plano contratado no momento</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Status</p>
              <p className={`mt-4 text-2xl font-black ${isCancelled ? 'text-red-600' : 'text-gray-900'}`}>
                {statusLabel}
              </p>
              <p className="mt-1 text-xs font-bold text-gray-500">
                {isActive
                  ? 'Assinatura liberada para uso'
                  : isCancelled
                    ? 'Seu sistema será bloqueado ao vencer'
                    : 'Periodo gratuito ativo'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Uso do Mes</p>
              <p className="mt-4 text-2xl font-black text-gray-900">
                {monthlyAppointmentsCount}
                {monthlyPlanLimit ? `/${monthlyPlanLimit}` : ''}
              </p>
              <p className="mt-1 text-xs font-bold text-gray-500">
                {monthlyPlanLimit
                  ? 'Agendamentos consumidos no periodo atual'
                  : 'Agendamentos com uso ilimitado'}
              </p>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Renovacao</p>
              <p className={`mt-4 text-2xl font-black ${isCancelled ? 'text-red-600' : 'text-gray-900'}`}>
                {isActive ? 'Mensal' : isCancelled ? 'Encerrando' : 'Teste'}
              </p>
              <p className="mt-1 text-xs font-bold text-gray-500">{prazoCurto}</p>
            </div>
          </div>

          {monthlyPlanLimit ? (
            <div className={`rounded-[2rem] border p-5 ${
              usagePercent >= 90 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    usagePercent >= 90 ? 'bg-red-100 text-red-600' : 'bg-white text-blue-600'
                  }`}>
                    <Info size={20} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${
                      usagePercent >= 90 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      Limite do Plano Essencial
                    </p>
                    <p className={`mt-1 text-sm font-bold ${usagePercent >= 90 ? 'text-red-700' : 'text-blue-700'}`}>
                      Voce usou {monthlyAppointmentsCount} de {monthlyPlanLimit} agendamentos neste mes.
                    </p>
                    <p className={`text-xs font-bold mt-1 opacity-80 ${
                      usagePercent >= 90 ? 'text-red-700' : 'text-blue-700'
                    }`}>
                      Utilizacao atual: {usagePercent}% do limite mensal.
                    </p>
                  </div>
                </div>

                {recommendedUpgrade && (
                  <button
                    onClick={() => setView('planos_assinatura')}
                    className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      usagePercent >= 90
                        ? 'bg-white text-red-700 border-red-200 hover:bg-red-100'
                        : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    Upgrade para {recommendedUpgrade.name}
                  </button>
                )}
              </div>

              <div className="mt-4 h-3 rounded-full bg-white/80 overflow-hidden border border-white">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent >= 90 ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Uso Ilimitado</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    Seu plano atual nao possui limite mensal de agendamentos.
                  </p>
                  <p className="text-xs font-bold text-emerald-700/80 mt-1">
                    Voce pode seguir usando todos os recursos liberados pelo seu plano.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // View: Planos de Assinatura (ou assinatura sem subscription ativa)
  if (view === 'planos_assinatura' || (view === 'assinatura' && !hasActiveSubscription)) {
    const handleAssinar = async (plan) => {
      try {
        showToast(`Iniciando checkout do plano ${plan.name}...`);
        const pref = await subscriptionService.createPaymentPreference(
          establishment,
          plan.id,
          user?.email
        );
        if (pref.init_point) {
          window.location.href = pref.init_point;
        }
      } catch (error) {
        console.error('Erro completo:', error);
        showToast('Erro ao processar pagamento. Verifique o console.', 'error');
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 flex flex-col md:flex-row md:items-start gap-4 shadow-sm">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              Informação Importante — Renovação Mensal
            </p>
            <p className="text-sm font-bold text-amber-900">
              Os pagamentos são processados de forma mensal via Checkout Mercado Pago (PIX, Cartão, Boleto).
            </p>
            <p className="text-xs font-bold text-amber-800/80">
              O débito automático recorrente direto no cartão (assinatura automática) está na fase final de
              homologação e será liberado em breve como melhoria gratuita para todos os planos.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-600">
              Planos de Assinatura
            </p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight mt-2">
              {hasActiveSubscription ? 'Upgrade de Plano' : 'Escolha Seu Plano'}
            </h2>
            <p className="text-gray-500 font-medium max-w-xl mt-2">
              {hasActiveSubscription
                ? 'Escolha um plano superior para liberar mais recursos e agendamentos ilimitados.'
                : 'Seu teste gratuito esta ativo. Escolha um plano para continuar usando todos os recursos sem interrupcao.'}
            </p>
          </div>
          {hasActiveSubscription && (
            <button
              onClick={() => setView('assinatura')}
              className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[11px] hover:bg-gray-50 transition-all"
            >
              Voltar para Assinatura
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const ehPlanoAtual =
              establishment?.subscription?.status === 'active' && plan.id === userPlan;
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-[3rem] p-8 border-2 transition-all hover:shadow-2xl ${
                  plan.popular
                    ? 'border-pink-600 shadow-xl shadow-pink-100 scale-105 z-10'
                    : 'border-gray-100 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Mais Popular
                  </div>
                )}

                <div className="space-y-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    plan.color === 'pink'
                      ? 'bg-pink-50 text-pink-600'
                      : plan.color === 'blue'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-amber-50 text-amber-600'
                  }`}>
                    {plan.icon && React.createElement(plan.icon, { size: 32 })}
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
                        <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                          plan.popular
                            ? 'bg-pink-100 text-pink-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Check size={12} strokeWidth={4} />
                        </div>
                        <span className="text-sm font-bold text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                      ehPlanoAtual
                        ? 'bg-pink-100 text-pink-700 hover:bg-pink-200 border-2 border-pink-200'
                        : plan.popular
                          ? 'bg-pink-600 text-white shadow-lg shadow-pink-200 hover:bg-pink-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    onClick={() => handleAssinar(plan)}
                  >
                    {ehPlanoAtual ? 'Renovar / Estender Plano' : 'Assinar Agora'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <CreditCard className="text-pink-400" />
            </div>
            <div>
              <h4 className="font-bold text-lg">Pagamento Seguro & Transparente</h4>
              <p className="text-sm text-white/60">Cancele quando quiser. Sem taxas escondidas.</p>
            </div>
          </div>
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
              <span className="text-[10px] font-black tracking-widest text-slate-900">VISA</span>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
              <span className="text-[9px] font-black tracking-widest text-slate-900">MASTER</span>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
              <span className="text-[10px] font-black tracking-widest text-slate-900">PAY</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AssinaturaSection;
