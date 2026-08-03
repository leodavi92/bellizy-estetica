import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Shield,
  Users,
  Plus,
  User,
  ChevronDown,
  Calendar,
  DollarSign,
  Star,
  MessageCircleMore,
  Pencil,
  Trash2,
  ClipboardList,
  Download
} from 'lucide-react';
import { anamnesisService } from '../../../../services/anamnesisService';
import { exportCsv } from '../../../../utils/csv';

const safeToDate = val => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
};

const formatPhone = tel => {
  if (!tel) return '';
  const clean = tel.replace(/\D/g, '');
  if (clean.length === 11)
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10)
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return tel;
};

const ClientesSection = ({
  user,
  clientsList,
  searchTerm,
  setSearchTerm,
  setIsClientModalOpen,
  visibleClientsCount,
  setVisibleClientsCount,
  expandedClientId,
  setExpandedClientId,
  setActiveClientTab,
  setClientAnamnesis,
  setSelectedClientAnamnesis,
  setLoadingClientAnamnesis,
  activeClientTab,
  clientAnamnesis,
  loadingClientAnamnesis,
  selectedClientAnamnesis,
  editingNote,
  setEditingNote,
  handleSaveNote,
  isSavingNote,
  allProfessionals,
  establishment,
  setDeleteConfirmModal,
  anamnesisTemplates,
  setAnamnesisTemplates,
  setAnamnesisCustomerId,
  setIsSelectingTemplate,
}) => {
  if (user?.tipo === 'staff') {
    return (
      <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
          <Shield size={40} />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">Acesso Restrito</h3>
        <p className="text-gray-500 font-medium max-w-sm">
          A gestão completa da base de clientes é permitida apenas para a Dona do estabelecimento.
        </p>
      </div>
    );
  }

  const handleExportCsv = () => {
    const headers = [
      'Nome',
      'Telefone',
      'E-mail',
      'Data Cadastro',
      'Última Visita',
      'Total Agendamentos',
      'Total Gasto (R$)',
      'Status'
    ];
    const rows = clientsList.map(c => {
      const cad = safeToDate(c.createdAt);
      const vis = safeToDate(c.lastVisit);
      const isInactive = !c.lastVisit || new Date() - new Date(c.lastVisit) > 60 * 24 * 3600 * 1000;
      return [
        String(c.nome || c.name || '').trim(),
        formatPhone(c.telefone || c.phone || ''),
        String(c.email || ''),
        c.createdAt ? format(cad, 'dd/MM/yyyy') : '',
        c.lastVisit ? format(vis, 'dd/MM/yyyy') : '',
        String(c.total_appointments || c.appointments_count || 0),
        String((c.total_spent || c.totalSpent || 0).toFixed(2)),
        isInactive ? 'Inativa' : 'Ativa'
      ];
    });
    exportCsv(`clientes-${String(establishment?.slug || establishment?.id || 'estetica')}`, [headers, ...rows]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Clientes</h2>
          <p className="text-gray-500 font-medium">
            Gestão da sua base de clientes ({clientsList.length}).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-3xl justify-end">
          <div className="relative flex-1 max-w-sm">
            <Users
              className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-pink-100 rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 shadow-sm"
            />
          </div>

          <button
            onClick={handleExportCsv}
            disabled={clientsList.length === 0}
            className="bg-white border-2 border-slate-100 text-slate-700 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            title="Exportar planilha CSV para Excel"
          >
            <Download size={15} />
            Exportar CSV
          </button>

          <button
            onClick={() => setIsClientModalOpen(true)}
            className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <Plus size={16} strokeWidth={3} />
            Novo Cliente
          </button>
        </div>
      </div>

      {clientsList.length === 0 ? (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
            <Users size={40} />
          </div>
          <p className="text-gray-400 font-medium">
            {searchTerm
              ? 'Nenhum cliente encontrado para sua busca.'
              : 'Sua lista de clientes aparecerá aqui conforme os agendamentos forem realizados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientsList.slice(0, visibleClientsCount).map(client => {
            const isExpanded = expandedClientId === client.uid;

            const lastVisitDate = client.lastVisit;
            const isInactive =
              !lastVisitDate || new Date() - lastVisitDate > 60 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={client.uid}
                className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? 'border-pink-200 shadow-xl shadow-pink-100/50 ring-1 ring-pink-100'
                    : 'border-gray-100 shadow-sm hover:border-pink-100'
                }`}
              >
                <button
                  onClick={() => {
                    if (expandedClientId === client.uid) {
                      setExpandedClientId(null);
                    } else {
                      setExpandedClientId(client.uid);
                      setActiveClientTab('detalhes');
                      setClientAnamnesis([]);
                      setSelectedClientAnamnesis(null);
                    }
                  }}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0 transition-transform duration-300 ${
                        isExpanded ? 'scale-110' : 'group-hover:scale-105'
                      }`}
                    >
                      {client.photoURL ? (
                        <img
                          src={client.photoURL}
                          alt={client.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-pink-50 flex items-center justify-center text-pink-300">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={`text-base font-black truncate transition-colors ${
                          isExpanded ? 'text-pink-600' : 'text-gray-800'
                        }`}
                      >
                        {client.nome}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isInactive ? 'bg-gray-300' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {isInactive ? 'Inativa' : 'Ativa'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isExpanded
                        ? 'bg-pink-600 text-white rotate-180'
                        : 'bg-gray-50 text-gray-400 group-hover:bg-pink-50 group-hover:text-pink-600'
                    }`}
                  >
                    <ChevronDown size={20} strokeWidth={3} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-gray-50 space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                            <Calendar size={14} className="text-gray-400 mb-1" />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">
                              Última
                            </span>
                            <span className="text-[11px] font-black text-gray-700 leading-none">
                              {client.lastVisit ? format(client.lastVisit, 'dd/MM/yy') : '---'}
                            </span>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                            <DollarSign size={14} className="text-emerald-400 mb-1" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter leading-none mb-1">
                              Gasto
                            </span>
                            <span className="text-[11px] font-black text-emerald-700 leading-none">
                              R$ {client.totalSpent}
                            </span>
                          </div>
                          <div className="bg-pink-50 p-3 rounded-2xl border border-pink-100 flex flex-col items-center justify-center text-center">
                            <Users size={14} className="text-pink-400 mb-1" />
                            <span className="text-[9px] font-black text-pink-400 uppercase tracking-tighter leading-none mb-1">
                              Visitas
                            </span>
                            <span className="text-[11px] font-black text-pink-700 leading-none">
                              {client.totalAppointments}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl w-fit">
                            <button
                              onClick={() => {
                                setActiveClientTab('detalhes');
                                setSelectedClientAnamnesis(null);
                              }}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeClientTab === 'detalhes'
                                  ? 'bg-white text-pink-600 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Detalhes
                            </button>
                            <button
                              onClick={() => {
                                setActiveClientTab('historico');
                                setSelectedClientAnamnesis(null);
                              }}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeClientTab === 'historico'
                                  ? 'bg-white text-pink-600 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Histórico
                            </button>
                            <button
                              data-anamnesis-refresh={client.uid}
                              onClick={async () => {
                                setActiveClientTab('anamnese');
                                setSelectedClientAnamnesis(null);
                                setLoadingClientAnamnesis(true);
                                try {
                                  const identifiers = [client.uid];
                                  if (client.telefone) {
                                    const cleanPhone = client.telefone.replace(/\D/g, '');
                                    if (cleanPhone) identifiers.push(cleanPhone);
                                  }
                                  const responses =
                                    await anamnesisService.getResponsesByCustomer(
                                      establishment.id,
                                      identifiers
                                    );
                                  setClientAnamnesis(responses);
                                } catch (error) {
                                  console.error('Erro ao carregar anamnese:', error);
                                } finally {
                                  setLoadingClientAnamnesis(false);
                                }
                              }}
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeClientTab === 'anamnese'
                                  ? 'bg-white text-pink-600 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Anamnese
                            </button>
                          </div>

                          <button
                            onClick={() => setDeleteConfirmModal({ open: true, client })}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all border border-red-50 hover:border-red-100"
                            title={client.type === 'manual' ? 'Excluir Cliente' : 'Ocultar da Lista'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="animate-in fade-in duration-300">
                          {activeClientTab === 'detalhes' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm font-bold text-gray-600 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                  <div className="w-8 h-8 bg-white text-emerald-500 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                                    <Star size={16} fill="currentColor" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-0.5">
                                      Contato Premium
                                    </p>
                                    <p className="truncate">{formatPhone(client.telefone)}</p>
                                  </div>
                                  {client.telefone && (
                                    <a
                                      href={`https://wa.me/${
                                        client.telefone
                                          .replace(/\D/g, '')
                                          .startsWith('55')
                                          ? client.telefone.replace(/\D/g, '')
                                          : `55${client.telefone.replace(/\D/g, '')}`
                                      }`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-auto w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-100"
                                    >
                                      <MessageCircleMore size={14} />
                                    </a>
                                  )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group/note relative">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Observações Internas
                                  </p>

                                  {editingNote.id === client.uid ? (
                                    <div className="space-y-2">
                                      <textarea
                                        autoFocus
                                        value={editingNote.text}
                                        onChange={e =>
                                          setEditingNote({ ...editingNote, text: e.target.value })
                                        }
                                        className="w-full bg-white border-2 border-pink-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none min-h-[80px] resize-none"
                                        placeholder="Digite aqui..."
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() =>
                                            setEditingNote({ id: null, text: '' })
                                          }
                                          className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          onClick={() => handleSaveNote(client)}
                                          disabled={isSavingNote}
                                          className="text-[9px] font-black uppercase text-pink-600 hover:text-pink-700 disabled:opacity-50"
                                        >
                                          {isSavingNote ? 'Salvando...' : 'Salvar'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() =>
                                        setEditingNote({
                                          id: client.uid,
                                          text: client.notes || '',
                                        })
                                      }
                                      className="cursor-pointer"
                                    >
                                      {client.notes ? (
                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                          {client.notes}
                                        </p>
                                      ) : (
                                        <p className="text-xs font-bold text-slate-500 italic">
                                          Clique para adicionar uma observação sobre esta cliente...
                                        </p>
                                      )}
                                      <div className="absolute top-4 right-4 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                        <Pencil size={12} className="text-pink-400" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : activeClientTab === 'historico' ? (
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                              {client.appointments?.length > 0 ? (
                                client.appointments.slice(0, 3).map((app, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-4 p-2 bg-white rounded-xl shadow-sm border border-gray-50"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-gray-800 truncate">
                                        {app.service_nome || app.serviceName}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-bold text-gray-400">
                                          {format(safeToDate(app.data_hora), "dd 'de' MMMM", {
                                            locale: ptBR,
                                          })}
                                        </p>
                                        {app.professional_id && (
                                          <>
                                            <span className="text-[10px] text-gray-300">•</span>
                                            <p className="text-[10px] font-black text-pink-500 uppercase tracking-tighter">
                                              {allProfessionals.find(
                                                p => p.id === app.professional_id
                                              )?.nome || 'Profissional'}
                                            </p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 shrink-0">
                                      R$ {app.total_price || app.preco || 0}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs font-bold text-gray-400 text-center py-4">
                                  Nenhum serviço realizado ainda.
                                </p>
                              )}
                              {client.appointments?.length > 5 && (
                                <p className="text-center text-[10px] font-black text-pink-500 pt-2 uppercase tracking-widest">
                                  Ver histórico completo
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                  Fichas de Anamnese
                                </h4>
                                <button
                                  onClick={async () => {
                                    const templates =
                                      await anamnesisService.getTemplates(establishment.id);
                                    setAnamnesisTemplates(templates);
                                    setAnamnesisCustomerId(client.uid);
                                    setIsSelectingTemplate(true);
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all shadow-sm active:scale-95"
                                >
                                  <Plus size={12} strokeWidth={3} />
                                  Nova Ficha
                                </button>
                              </div>

                              {selectedClientAnamnesis ? (
                                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                  <div className="flex items-center justify-between px-2">
                                    <div>
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                        {selectedClientAnamnesis.template_nome}
                                      </h4>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        Preenchida em{' '}
                                        {format(
                                          selectedClientAnamnesis.createdAt?.toDate
                                            ? selectedClientAnamnesis.createdAt.toDate()
                                            : new Date(selectedClientAnamnesis.createdAt),
                                          "dd/MM/yyyy 'às' HH:mm"
                                        )}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setSelectedClientAnamnesis(null)}
                                      className="text-[9px] font-black uppercase text-pink-600 hover:text-pink-700"
                                    >
                                      Voltar à lista
                                    </button>
                                  </div>

                                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                    {selectedClientAnamnesis.respostas &&
                                      Object.entries(selectedClientAnamnesis.respostas).map(
                                        ([qId, data], idx) => {
                                          const enunciado =
                                            typeof data === 'object' && data.enunciado
                                              ? data.enunciado
                                              : `Pergunta ${idx + 1}`;
                                          const answer =
                                            typeof data === 'object' && data.enunciado
                                              ? data.resposta
                                              : data;

                                          return (
                                            <div key={qId} className="space-y-1.5">
                                              <div className="flex items-start gap-2">
                                                <span className="text-[9px] font-black text-pink-500 mt-0.5">
                                                  {idx + 1}.
                                                </span>
                                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                                                  {enunciado}
                                                </p>
                                              </div>
                                              <div className="pl-4">
                                                <div className="text-xs font-bold text-slate-600 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed shadow-sm">
                                                  {Array.isArray(answer)
                                                    ? answer.join(', ')
                                                    : typeof answer === 'object' &&
                                                      answer !== null
                                                    ? `${answer.choice}${
                                                        answer.choice === 'Sim'
                                                          ? `: ${answer.text}`
                                                          : ''
                                                      }`
                                                    : answer || 'Não respondido'}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }
                                      )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {loadingClientAnamnesis ? (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                                      <div className="w-6 h-6 border-2 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Buscando fichas...
                                      </p>
                                    </div>
                                  ) : clientAnamnesis.length > 0 ? (
                                    clientAnamnesis.map(resp => (
                                      <div
                                        key={resp.id}
                                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center shrink-0">
                                            <ClipboardList size={20} />
                                          </div>
                                          <div>
                                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">
                                              {resp.template_nome || 'Ficha de Anamnese'}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                              {format(
                                                resp.createdAt?.toDate
                                                  ? resp.createdAt.toDate()
                                                  : new Date(resp.createdAt),
                                                'dd/MM/yyyy'
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() =>
                                            setSelectedClientAnamnesis(resp)
                                          }
                                          className="px-4 py-2 bg-pink-50 text-pink-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                        >
                                          Ver
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="py-8 text-center space-y-2">
                                      <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                                        <ClipboardList size={24} />
                                      </div>
                                      <p className="text-xs font-bold text-gray-400">
                                        Nenhuma ficha preenchida para esta cliente.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {clientsList.length > visibleClientsCount && (
            <div className="pt-6 flex justify-center">
              <button
                onClick={() => setVisibleClientsCount(prev => prev + 10)}
                className="px-8 py-4 bg-white border-2 border-pink-100 text-pink-600 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-pink-50 transition-all shadow-sm active:scale-95"
              >
                Ver mais clientes ({clientsList.length - visibleClientsCount} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientesSection;
