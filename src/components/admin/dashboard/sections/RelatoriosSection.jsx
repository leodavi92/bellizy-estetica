import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, FileDown, TrendingUp, CalendarCheck, Users, Lock } from 'lucide-react';

const RelatoriosSection = ({
  hasAccess,
  setView,
  setIsReportModalOpen,
  setPeriod,
  financeTransactions,
  allAppointments,
  clientsList,
}) => {
  if (!hasAccess('relatorios_avancados')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in zoom-in-95">
        <div className="w-24 h-24 bg-pink-50 text-pink-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-pink-100">
          <Lock size={48} />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
            Recurso Premium
          </h3>
          <p className="text-gray-500 font-medium">
            O módulo de Relatórios Avançados está disponível apenas nos planos{' '}
            <strong>Profissional</strong> e <strong>Premium VIP</strong>.
          </p>
        </div>
      </div>
    );
  }

  const ticketMedio =
    financeTransactions.length > 0
      ? (
          financeTransactions.reduce((sum, t) => sum + Number(t.total_value || 0), 0) /
          financeTransactions.length
        ).toFixed(2)
      : '0.00';

  // Ranking de serviços
  const serviceStats = {};
  financeTransactions.forEach(t => {
    const name = t.service_nome || 'Outros';
    if (!serviceStats[name]) serviceStats[name] = { count: 0, revenue: 0 };
    serviceStats[name].count += 1;
    serviceStats[name].revenue += Number(t.total_value || 0);
  });

  const sortedStats = Object.entries(serviceStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  const maxRevenue = sortedStats[0]?.[1]?.revenue || 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('financas')}
            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-pink-600 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Relatórios</h2>
            <p className="text-gray-500 font-medium">Análise detalhada de performance e faturamento.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-pink-100 shadow-sm">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
            title="Exportar PDF Financeiro"
          >
            <FileDown size={16} />
          </button>
          <button
            onClick={() => setPeriod('month')}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-pink-600 text-white shadow-md shadow-pink-100"
          >
            Este Mês
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card: Ticket Médio */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
          <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-6">
            <TrendingUp size={24} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Médio</p>
          <h3 className="text-3xl font-black text-gray-900">R$ {ticketMedio}</h3>
          <p className="text-xs text-gray-500 font-medium mt-2">Valor médio por atendimento</p>
        </div>

        {/* Card: Total de Atendimentos */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
            <CalendarCheck size={24} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de Atendimentos</p>
          <h3 className="text-3xl font-black text-gray-900">{allAppointments.length}</h3>
          <p className="text-xs text-gray-500 font-medium mt-2">Histórico total acumulado</p>
        </div>

        {/* Card: Clientes na Base */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
            <Users size={24} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Clientes na Base</p>
          <h3 className="text-3xl font-black text-gray-900">{clientsList.length}</h3>
          <p className="text-xs text-gray-500 font-medium mt-2">Clientes únicos cadastrados</p>
        </div>
      </div>

      {/* Serviços Mais Procurados */}
      <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-pink-50 flex justify-between items-center bg-pink-50/20">
          <h4 className="text-sm font-black text-pink-900 uppercase tracking-widest">Ranking de Serviços</h4>
          <span className="text-[10px] font-bold text-pink-400 uppercase">Top Performers</span>
        </div>
        <div className="p-8">
          <div className="space-y-6">
            {sortedStats.length === 0 ? (
              <p className="text-center text-gray-400 font-medium py-10">
                Nenhum dado financeiro para exibir o ranking.
              </p>
            ) : (
              sortedStats.map(([name, stats], idx) => (
                <div key={name} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-pink-200">0{idx + 1}</span>
                      <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">R$ {stats.revenue.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {stats.count} atendimentos
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.revenue / maxRevenue) * 100}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className="h-full bg-pink-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatoriosSection;
