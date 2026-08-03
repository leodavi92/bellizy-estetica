import React from 'react';
import { format, startOfDay, endOfDay, isSameDay, startOfMonth, subDays, startOfYear, addDays } from 'date-fns';
import {
  Plus,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Share2,
  Clock,
  Calendar,
  CalendarCheck,
  Check,
  DollarSign,
  LogOut,
  Percent,
  Trash2,
  Lock,
  Download
} from 'lucide-react';
import { exportCsv } from '../../../../utils/csv';

export default function FinancasSection({
  view, hasAccess, userPlan, user, establishment, allProfessionals, team,
  financeMode, setFinanceMode, setIsExpenseModalOpen, setView, loadFinanceData, financeLoading,
  financeFilter, setPeriod, financeTransactions, handleMarkAsPaid,
  expenses, setExpenseToDelete, setTeamSelectedProfessionalId,
  teamSelectedProfessionalId
}) {

  const paymentLabel = (method) => {
    const m = String(method || 'pix').toLowerCase();
    if (m === 'pix') return 'PIX';
    if (m === 'dinheiro' || m === 'cash') return 'DINHEIRO';
    if (m === 'credito' || m === 'crédito' || m === 'credit') return 'CRÉDITO';
    if (m === 'debito' || m === 'débito' || m === 'debit') return 'DÉBITO';
    return m.toUpperCase();
  };

  const txDate = (t) => {
    const raw = t.date || t.createdAt || t.data || t.data_pagamento;
    if (!raw) return null;
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (raw instanceof Date) return raw;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const handleExportCsv = () => {
    const headers = [
      'Data',
      'Tipo',
      'Categoria',
      'Descrição',
      'Cliente',
      'Profissional',
      'Serviço',
      'Forma Pagamento',
      'Valor Total (R$)',
      'Comissão (R$)',
      'Status',
      'ID'
    ];

    const receitas = Array.isArray(financeTransactions) ? financeTransactions.map(t => {
      const d = txDate(t);
      return [
        d ? format(d, 'dd/MM/yyyy HH:mm') : '',
        'Receita',
        String(t.category || t.tipo_categoria || 'Atendimento'),
        String(t.description || t.descricao || ''),
        String(t.client_name || t.cliente_nome || t.user_nome || ''),
        String(t.professional_name || t.profissional_nome || ''),
        String(t.service_nome || t.service_name || ''),
        paymentLabel(t.payment_method || t.forma_pagamento),
        Number(t.total_value || t.valor || 0).toFixed(2),
        Number(t.commission_value || t.comissao || 0).toFixed(2),
        String(t.status || 'pending'),
        String(t.id || '')
      ];
    }) : [];

    const despesas = Array.isArray(expenses) ? expenses.map(e => {
      const d = txDate(e);
      return [
        d ? format(d, 'dd/MM/yyyy HH:mm') : '',
        'Despesa',
        String(e.category || e.categoria || 'Despesa'),
        String(e.description || e.descricao || ''),
        '',
        String(e.responsible_name || e.responsavel || ''),
        '',
        paymentLabel(e.payment_method || e.forma_pagamento || 'pix'),
        (-Number(e.value || e.valor || 0)).toFixed(2),
        '0.00',
        String(e.status || 'pago'),
        String(e.id || '')
      ];
    }) : [];

    const all = [...receitas, ...despesas].sort((a, b) => {
      const da = a[0]; const db = b[0];
      if (!da && !db) return 0;
      if (!da) return 1; if (!db) return -1;
      return db.localeCompare(da);
    });

    const suffix = view === 'comissoes'
      ? 'comissoes'
      : (financeMode === 'equipe' || financeMode === 'equipe_restricted')
        ? 'equipe'
        : 'financeiro';
    exportCsv(`${suffix}-${String(establishment?.slug || establishment?.id || 'estetica')}`, [headers, ...all]);
  };

  const UpgradeRequired = ({ feature }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in zoom-in-95">
      <div className="w-24 h-24 bg-pink-50 text-pink-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-pink-100">
        <Lock size={48} />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Recurso Premium</h3>
        <p className="text-gray-500 font-medium">
          O módulo de {feature} está disponível apenas nos planos <strong>Profissional</strong> e <strong>Premium VIP</strong>.
        </p>
      </div>
      <button 
        onClick={() => setView('planos_assinatura')}
        className="bg-pink-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95"
      >
        Ver Planos de Assinatura
      </button>
    </div>
  );

  return (
    view === 'financas' && !hasAccess('financas') ? (
      <UpgradeRequired feature="Gestão Financeira" />
    ) : (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20" id="finance-report">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
              {view === 'comissoes' ? 'Comissões' : 'Finanças'}
            </h2>
            {view === 'financas' && (
              <p className="text-gray-500 font-medium">
                Controle seu faturamento e comissões.
              </p>
            )}
            {view === 'financas' && (
              <div className="mt-4 inline-flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-sm">
                <button
                  onClick={() => setFinanceMode('salao')}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    financeMode === 'salao'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Salão
                </button>
                <button
                  onClick={() => {
                    if (userPlan === 'bronze') {
                      setFinanceMode('equipe_restricted');
                    } else {
                      setFinanceMode('equipe');
                    }
                  }}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    financeMode === 'equipe' || financeMode === 'equipe_restricted'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Equipe
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {view === 'financas' && (
              <>
                <button
                  onClick={handleExportCsv}
                  className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"
                  title="Exportar CSV Receitas + Despesas"
                >
                  <Download size={18} />
                </button>

                <button 
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100"
                  title="Registrar Despesa"
                >
                  <Plus size={18} />
                </button>

                <button 
                  onClick={() => {
                    if (userPlan !== 'gold') {
                      setFinanceMode('relatorios_restricted');
                    } else {
                      setView('relatorios');
                    }
                  }}
                  className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                  title="Relatórios Detalhados"
                >
                  <TrendingUp size={18} />
                </button>
              </>
            )}

            {view === 'financas' && (
              <button 
                onClick={loadFinanceData}
                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-pink-600 transition-all shadow-sm"
                title="Atualizar dados"
              >
                <RefreshCw size={18} className={financeLoading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {financeMode === 'equipe_restricted' ? (
          <UpgradeRequired feature="Gestão de Comissões e Equipe" />
        ) : financeMode === 'relatorios_restricted' ? (
          <UpgradeRequired feature="Relatórios Avançados" />
        ) : (financeMode === 'equipe' || view === 'comissoes') ? (
          <div className="space-y-6">
            {(teamSelectedProfessionalId || view === 'comissoes') ? (
              (() => {
                const targetProfId = view === 'comissoes' ? (user?.professional_id || 'owner') : teamSelectedProfessionalId;
                const prof = allProfessionals.find(p => p.id === targetProfId);
                const profTx = financeTransactions
                  .filter(t => t.professional_id === targetProfId)
                  .filter(t => Number(t.total_value || 0) > 0 || Number(t.commission_value || 0) > 0)
                  .sort((a, b) => {
                    const rawA = a.createdAt || a.date;
                    const rawB = b.createdAt || b.date;
                    const aMs = rawA?.toDate ? rawA.toDate().getTime() : new Date(rawA).getTime();
                    const bMs = rawB?.toDate ? rawB.toDate().getTime() : new Date(rawB).getTime();
                    return bMs - aMs;
                  });

                const revenue = profTx.reduce((sum, t) => sum + Number(t.total_value || 0), 0);
                const received = profTx.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.commission_value || 0), 0);
                const pending = profTx.filter(t => t.status !== 'paid').reduce((sum, t) => sum + Number(t.commission_value || 0), 0);

                const totalCommission = received + pending;
                const paidRatio = totalCommission > 0 ? received / totalCommission : 0;
                const r = 42;
                const c = 2 * Math.PI * r;

                const dailyRevenue = {};
                profTx.forEach(t => {
                  const raw = t.createdAt || t.date;
                  const d = raw?.toDate ? raw.toDate() : new Date(raw);
                  const key = format(d, 'yyyy-MM-dd');
                  dailyRevenue[key] = (dailyRevenue[key] || 0) + Number(t.total_value || 0);
                });

                const seriesStart = startOfDay(financeFilter.startDate);
                const seriesEnd = endOfDay(financeFilter.endDate);
                const seriesKeys = [];
                for (let cursor = seriesStart; cursor <= seriesEnd; cursor = addDays(cursor, 1)) {
                  seriesKeys.push(format(cursor, 'yyyy-MM-dd'));
                }

                const seriesValues = seriesKeys.map(k => Number(dailyRevenue[k] || 0));
                const max = Math.max(...seriesValues, 1);

                const seriesPoints = seriesKeys.map((k, idx) => {
                  const x = seriesKeys.length === 1 ? 50 : (idx / (seriesKeys.length - 1)) * 100;
                  const y = 38 - (Number(dailyRevenue[k] || 0) / max) * 30;
                  return `${x},${y}`;
                });
                const points = seriesPoints.join(' ');
                const areaD = seriesPoints.length > 0
                  ? `M ${seriesPoints[0]} L ${seriesPoints.slice(1).join(' L ')} L 100,40 L 0,40 Z`
                  : '';

                const paymentLabel = (method) => {
                  const m = String(method || 'pix').toLowerCase();
                  if (m === 'pix') return 'PIX';
                  if (m === 'dinheiro' || m === 'cash') return 'DINHEIRO';
                  if (m === 'credito' || m === 'crédito' || m === 'credit') return 'CRÉDITO';
                  if (m === 'debito' || m === 'débito' || m === 'debit') return 'DÉBITO';
                  return m.toUpperCase();
                };

                return (
                  <div className="space-y-6">
                    <div className="bg-white rounded-[2.75rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                      {/* Cabeçalho Rosa com Texto e Botões */}
                      <div className="h-32 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 relative px-6 sm:px-8 flex items-center justify-between pb-10">
                        {view === 'financas' ? (
                          <button
                            onClick={() => setTeamSelectedProfessionalId(null)}
                            className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                            title="Voltar"
                          >
                            <ChevronLeft size={18} />
                          </button>
                        ) : (
                            <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-white drop-shadow-md max-w-[200px] sm:max-w-none leading-tight">
                              Acompanhe seus ganhos e atendimentos.
                            </p>
                          )}

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={loadFinanceData}
                            className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                            title="Atualizar dados"
                          >
                            <RefreshCw size={18} className={financeLoading ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => {
                              const services = profTx.map(t => `• ${t.service_nome}: R$ ${Number(t.commission_value).toFixed(2)} (${t.status === 'paid' ? 'Pago' : 'Pendente'})`).join('%0A');
                              const message = encodeURIComponent(`*EXTRATO DE COMISSÕES*%0A*${establishment?.nome}*%0A%0A*Profissional:* ${prof?.nome}%0A*Período:* ${format(financeFilter.startDate, 'dd/MM')} a ${format(financeFilter.endDate, 'dd/MM')}%0A%0A*LANÇAMENTOS:*%0A${services}%0A%0A*RECEBIDO:* R$ ${received.toFixed(2)}%0A*PENDENTE:* R$ ${pending.toFixed(2)}%0A%0A✨ _Confira seus lançamentos!_`);
                              window.open(`https://wa.me/?text=${message}`, '_blank');
                            }}
                            className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                            title="Compartilhar extrato"
                          >
                            <Share2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="px-6 sm:px-8 pb-8 -mt-12 relative z-10">
                        <div className="flex flex-col items-center text-center">
                          <div className="w-20 h-20 rounded-[2rem] overflow-hidden bg-white shadow-xl ring-4 ring-white">
                            {prof?.foto ? (
                              <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-pink-50 text-pink-600 font-black text-3xl">
                                {prof?.nome?.charAt(0) || 'P'}
                              </div>
                            )}
                          </div>
                          <h3 className="mt-4 text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {prof?.nome || 'Profissional'}
                          </h3>
                          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full border border-slate-100">
                              {prof?.cargo || 'Profissional'}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-pink-50 text-pink-600 rounded-full border border-pink-100">
                              {format(financeFilter.startDate, 'dd/MM')} - {format(financeFilter.endDate, 'dd/MM')}
                            </span>
                          </div>

                          {/* Filtros de Período reposicionados */}
                          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4 overflow-x-auto no-scrollbar">
                            {[
                              { id: 'today', label: 'Hoje', icon: <Clock size={12} /> },
                              { id: 'week', label: 'Últimos 7 dias', icon: <Calendar size={12} /> },
                              { id: 'month', label: 'Mês Atual', icon: <CalendarCheck size={12} /> },
                              { id: 'year', label: 'Este Ano', icon: <TrendingUp size={12} /> }
                            ].map(p => {
                              const isActive = isSameDay(financeFilter.startDate, p.id === 'today' ? startOfDay(new Date()) : p.id === 'month' ? startOfMonth(new Date()) : p.id === 'year' ? startOfYear(new Date()) : subDays(new Date(), 7));
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => setPeriod(p.id)}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${
                                    isActive 
                                      ? 'bg-slate-900 text-white shadow-md' 
                                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                  }`}
                                >
                                  {p.icon}
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                          <div className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bruto Faturado</p>
                            <p className="text-2xl font-black text-slate-900 mt-2">R$ {revenue.toFixed(2)}</p>
                          </div>
                          <div className="p-5 rounded-[2rem] bg-emerald-50 border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Já Recebeu</p>
                            <p className="text-2xl font-black text-emerald-700 mt-2">R$ {received.toFixed(2)}</p>
                          </div>
                          <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pendente</p>
                            <p className="text-2xl font-black text-amber-700 mt-2">R$ {pending.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                        <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Pagamentos (Comissão)</p>
                        <div className="flex items-center gap-6">
                          <div className="relative w-[120px] h-[120px]">
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                              <circle cx="50" cy="50" r={r} stroke="#f1f5f9" strokeWidth="12" fill="none" />
                              <circle
                                cx="50"
                                cy="50"
                                r={r}
                                stroke="#10b981"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${paidRatio * c} ${c}`}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pago</p>
                              <p className="text-lg font-black text-slate-900">{Math.round(paidRatio * 100)}%</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recebido</p>
                                <p className="text-sm font-black text-slate-900">R$ {received.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-amber-400 rounded-full" />
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendente</p>
                                <p className="text-sm font-black text-slate-900">R$ {pending.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                        <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Faturamento (Linha)</p>
                        {seriesKeys.length === 0 ? (
                          <div className="h-40 flex items-center justify-center">
                            <p className="text-sm font-bold text-slate-400 italic">Sem dados no período.</p>
                          </div>
                        ) : (
                          <div className="h-40">
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                              <defs>
                                <linearGradient id={`revFill-${targetProfId || 'all'}`} x1="0" x2="0" y1="0" y2="1">
                                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.28" />
                                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {[10, 20, 30].map(y => (
                                <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.5" opacity="0.7" />
                              ))}
                              {areaD ? <path d={areaD} fill={`url(#revFill-${targetProfId || 'all'})`} /> : null}
                              <polyline points={points} fill="none" stroke="#ec4899" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                              {(() => {
                                const step = seriesKeys.length > 45 ? Math.ceil(seriesKeys.length / 20) : 1;
                                return seriesKeys.map((k, idx) => {
                                  if (idx % step !== 0 && idx !== seriesKeys.length - 1) return null;
                                  const x = seriesKeys.length === 1 ? 50 : (idx / (seriesKeys.length - 1)) * 100;
                                  const y = 38 - (Number(dailyRevenue[k] || 0) / max) * 30;
                                  return (
                                    <circle
                                      key={k}
                                      cx={x}
                                      cy={y}
                                      r="1.7"
                                      fill="#ec4899"
                                      stroke="#ffffff"
                                      strokeWidth="0.8"
                                    />
                                  );
                                });
                              })()}
                            </svg>
                            <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <span>{format(new Date(seriesKeys[0]), 'dd/MM')}</span>
                              <span>{format(new Date(seriesKeys[seriesKeys.length - 1]), 'dd/MM')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Histórico do Profissional</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{profTx.length} registros no período</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-white">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pagamento</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Comissão</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                              {view === 'financas' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {financeLoading ? (
                              <tr>
                                <td colSpan={view === 'comissoes' ? 7 : 8} className="px-6 py-20 text-center">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                                    <p className="text-xs font-bold text-slate-400 uppercase">Carregando dados...</p>
                                  </div>
                                </td>
                              </tr>
                            ) : profTx.length === 0 ? (
                              <tr>
                                <td colSpan={view === 'comissoes' ? 7 : 8} className="px-6 py-20 text-center">
                                  <p className="text-sm font-bold text-slate-400 italic">Nenhum atendimento finalizado neste período.</p>
                                </td>
                              </tr>
                            ) : (
                              profTx.map((transaction) => (
                                <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4">
                                    {(() => {
                                      const raw = transaction.createdAt || transaction.date;
                                      const dt = raw?.toDate ? raw.toDate() : new Date(raw);
                                      return (
                                        <>
                                          <p className="text-xs font-bold text-slate-700">{format(dt, "dd/MM")}</p>
                                          <p className="text-[9px] text-slate-400 font-medium">{format(dt, "HH:mm")}</p>
                                        </>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-bold text-slate-900">{transaction.user_nome}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-medium text-slate-600">{transaction.service_nome}</p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">
                                      {paymentLabel(transaction.payment_method)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <p className="text-xs font-black text-slate-900">R$ {transaction.total_value?.toFixed(2)}</p>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <p className="text-xs font-black text-pink-600">R$ {transaction.commission_value?.toFixed(2)}</p>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                      transaction.status === 'paid' 
                                        ? 'bg-emerald-100 text-emerald-600' 
                                        : 'bg-amber-100 text-amber-600'
                                    }`}>
                                      {transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                    </span>
                                  </td>
                                  {view === 'financas' && (
                                    <td className="px-6 py-4 text-right">
                                      {transaction.status !== 'paid' && (
                                        <button
                                          onClick={() => handleMarkAsPaid(transaction.id)}
                                          className="p-2 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                          title="Marcar como Pago"
                                        >
                                          <Check size={14} />
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProfessionals.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => setTeamSelectedProfessionalId(prof.id)}
                    className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 shrink-0">
                      {prof.foto ? (
                        <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-pink-50 text-pink-600 font-black text-xl">
                          {prof.nome?.charAt(0) || 'P'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prof.cargo || 'Profissional'}</p>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{prof.nome}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ver detalhes</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Cards de Resumo Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                const filtered = financeTransactions.filter(t => 
                  financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId
                );
                const totalRevenue = filtered.reduce((sum, t) => sum + Number(t.total_value || 0), 0);
                const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.value || 0), 0);
                const pendingCommissions = filtered
                  .filter(t => t.status !== 'paid')
                  .reduce((sum, t) => sum + Number(t.commission_value || 0), 0);
                const netProfit = totalRevenue - filtered.reduce((sum, t) => sum + Number(t.commission_value || 0), 0) - totalExpenses;

                return (
                  <>
                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <DollarSign size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento Bruto</p>
                        <h3 className="text-2xl font-black text-gray-800">R$ {totalRevenue.toFixed(2)}</h3>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                        <LogOut size={24} className="rotate-180" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Despesas</p>
                        <h3 className="text-2xl font-black text-gray-800">R$ {totalExpenses.toFixed(2)}</h3>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Percent size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comissões Pendentes</p>
                        <h3 className="text-2xl font-black text-gray-800">R$ {pendingCommissions.toFixed(2)}</h3>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-800 shadow-xl flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucro Real</p>
                        <h3 className="text-2xl font-black text-white">R$ {netProfit.toFixed(2)}</h3>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

        {/* Botões de Período Arredondados abaixo do Saldo */}
        <div className="flex flex-wrap items-center gap-2 bg-gray-50/50 p-2 rounded-[2rem] border border-gray-100 w-fit">
          {[
            { id: 'today', label: 'Hoje', icon: <Clock size={12} /> },
            { id: 'week', label: 'Últimos 7 dias', icon: <Calendar size={12} /> },
            { id: 'month', label: 'Mês Atual', icon: <CalendarCheck size={12} /> },
            { id: 'year', label: 'Este Ano', icon: <TrendingUp size={12} /> }
          ].map(p => {
            const isActive = isSameDay(financeFilter.startDate, p.id === 'today' ? startOfDay(new Date()) : p.id === 'month' ? startOfMonth(new Date()) : p.id === 'year' ? startOfYear(new Date()) : subDays(new Date(), 7));
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  isActive 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100 shadow-sm'
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Gráfico Simples de Faturamento por Dia */}
        {financeTransactions.length > 0 && (
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Faturamento por Dia</h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full">Desempenho Diário</span>
            </div>
            
            <div className="h-64 flex items-end gap-3 sm:gap-6 px-2 overflow-x-auto pb-4 custom-scrollbar">
              {(() => {
                const dailyData = {};
                const filteredTransactions = financeTransactions.filter(t => 
                  financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId
                );

                filteredTransactions.forEach(t => {
                  const dateStr = format(t.date?.toDate ? t.date.toDate() : new Date(t.date), 'dd/MM');
                  dailyData[dateStr] = (dailyData[dateStr] || 0) + Number(t.total_value || 0);
                });
                
                const labels = Object.keys(dailyData).sort((a, b) => {
                  const [dayA, monthA] = a.split('/').map(Number);
                  const [dayB, monthB] = b.split('/').map(Number);
                  return monthA !== monthB ? monthA - monthB : dayA - dayB;
                });
                
                const max = Math.max(...Object.values(dailyData), 1);
                
                return labels.map(label => {
                  const value = dailyData[label];
                  const heightPercent = Math.max((value / max) * 100, 8); // Mínimo 8% para visibilidade
                  
                  return (
                    <div key={label} className="flex flex-col items-center gap-4 group relative min-w-[40px] sm:min-w-[60px] h-full justify-end">
                      {/* Valor fixo sobre a barra (sempre visível ou no hover) */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20 shadow-xl pointer-events-none border border-slate-700">
                        R$ {value.toFixed(2)}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                      </div>

                      {/* A barra com cor sólida e largura garantida */}
                      <div 
                        className="w-10 sm:w-14 bg-pink-500 rounded-2xl transition-all relative shadow-lg shadow-pink-200 group-hover:bg-pink-600 group-hover:shadow-pink-300"
                        style={{ height: `${heightPercent}%` }}
                      >
                        {/* Brilho interno na barra */}
                        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                      </div>

                      {/* Label da data */}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">
                          {label}
                        </span>
                        <div className="w-1 h-1 bg-pink-500 rounded-full mt-1 opacity-40" />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* Linha de Base Decorativa */}
            <div className="h-1 w-full bg-slate-50 rounded-full mt-2" />
          </div>
        )}

        {/* Lista de Transações Detalhada */}
        <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Histórico de Atendimentos</h4>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-50 text-pink-600 rounded-full">
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Hoje: {format(new Date(), 'dd/MM')}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissional</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pagamento</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Comissão</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {financeLoading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-400 uppercase">Carregando dados...</p>
                      </div>
                    </td>
                  </tr>
                ) : (() => {
                  const todayTransactions = financeTransactions
                    .filter(t => {
                      const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                      const isToday = isSameDay(tDate, new Date());
                      const matchesProf = financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId;
                      return isToday && matchesProf;
                    });

                  return todayTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-20 text-center">
                        <p className="text-sm font-bold text-slate-400 italic">Nenhum atendimento finalizado hoje.</p>
                      </td>
                    </tr>
                  ) : (
                    todayTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">
                            {transaction.date?.toDate ? format(transaction.date.toDate(), "dd/MM") : '--/--'}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium">
                            {transaction.date?.toDate ? format(transaction.date.toDate(), "HH:mm") : '--:--'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-900">{transaction.user_nome}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{transaction.professional_nome}</p>
                          <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter">
                            {transaction.commission_percentage}%
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-medium text-slate-600">{transaction.service_nome}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">
                            {transaction.payment_method || 'PIX'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-xs font-black text-slate-900">R$ {transaction.total_value?.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-xs font-black text-pink-600">R$ {transaction.commission_value?.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            transaction.status === 'paid' 
                              ? 'bg-emerald-100 text-emerald-600' 
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            {transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {transaction.status !== 'paid' && (
                            <button
                              onClick={() => handleMarkAsPaid(transaction.id)}
                              className="p-2 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                              title="Marcar como Pago"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista de Despesas */}
        {expenses.length > 0 && (
          <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden mt-6">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-rose-50/20">
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">Controle de Despesas</h4>
              <span className="text-[10px] font-bold text-rose-400 uppercase">{expenses.length} registros no período</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-rose-50/10 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-700">
                          {expense.date?.toDate ? format(expense.date.toDate(), "dd/MM") : '--/--'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900">{expense.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-rose-50 text-rose-600 rounded-lg">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-xs font-black text-rose-600">R$ {Number(expense.value).toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setExpenseToDelete(expense)}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    )
  );
}
