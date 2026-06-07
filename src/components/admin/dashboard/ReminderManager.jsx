import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  User, 
  X, 
  Send, 
  Users, 
  Trash2, 
  Pencil, 
  Sparkles,
  AlertCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { reminderService } from '../../../services/reminderService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ReminderManager({ establishment, allAppointments = [] }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [searchClient, setSearchClient] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, title: '' });
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    if (establishment?.id) {
      loadReminders();
    }
  }, [establishment?.id]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await reminderService.getReminders(establishment.id);
      setReminders(data);
    } catch (error) {
      console.error("Erro ao carregar lembretes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingReminder.titulo || !editingReminder.mensagem) return;

    try {
      await reminderService.saveReminder(establishment.id, editingReminder);
      setIsEditModalOpen(false);
      loadReminders();
    } catch (error) {
      alert("Erro ao salvar lembrete.");
    }
  };

  const handleDelete = async () => {
    try {
      await reminderService.deleteReminder(deleteConfirm.id);
      setDeleteConfirm({ open: false, id: null, title: '' });
      loadReminders();
    } catch (error) {
      alert("Erro ao excluir lembrete.");
    }
  };

  const handleSendMulti = (reminder) => {
    // Remove qualquer menção às variáveis no envio múltiplo para evitar que o código apareça no texto
    const cleanMessage = reminder.mensagem
      .replace(/{nome}/g, '')
      .replace(/{serviço}/g, 'procedimento')
      .replace(/{data}/g, '')
      .replace(/{estética}/g, establishment?.nome || '')
      .replace(/\s\s+/g, ' ')
      .trim();
    const encodedMessage = encodeURIComponent(cleanMessage);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleSendIndividual = (client, reminder) => {
    let message = reminder.mensagem;
    
    // Substitui variáveis
    if (client.user_nome) {
      message = message.replace(/{nome}/g, client.user_nome);
    }
    
    if (client.service_nome) {
      message = message.replace(/{serviço}/g, client.service_nome);
    } else {
      message = message.replace(/{serviço}/g, 'procedimento');
    }

    if (client.latest_date) {
      message = message.replace(/{data}/g, format(client.latest_date, "dd/MM", { locale: ptBR }));
    } else {
      message = message.replace(/{data}/g, '');
    }

    message = message.replace(/{estética}/g, establishment?.nome || '');

    const encodedMessage = encodeURIComponent(message);
    let phone = client.user_telefone || '';
    const cleaned = phone.replace(/\D/g, '');
    const formattedPhone = cleaned.length >= 10 ? (cleaned.startsWith('55') ? cleaned : `55${cleaned}`) : '';

    if (!formattedPhone) {
      alert("Esta cliente não possui um telefone válido.");
      return;
    }

    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
    setIsSendModalOpen(false);
  };

  const filteredClients = useMemo(() => {
    const clientsMap = new Map();
    allAppointments.forEach(app => {
      if (!app.user_nome) return;
      const key = app.user_id || app.user_telefone;
      
      const appDate = app.data_hora?.seconds ? new Date(app.data_hora.seconds * 1000) : new Date(app.data_hora);
      const existing = clientsMap.get(key);
      
      if (!existing || appDate > existing.latest_date) {
        clientsMap.set(key, {
          user_id: app.user_id,
          user_nome: app.user_nome,
          user_telefone: app.user_telefone,
          service_nome: app.service_nome,
          latest_date: appDate
        });
      }
    });

    const search = searchClient.toLowerCase();
    return Array.from(clientsMap.values())
      .filter(c => c.user_nome.toLowerCase().includes(search) || c.user_telefone?.includes(search))
      .slice(0, 20);
  }, [allAppointments, searchClient]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <MessageSquare className="text-pink-600" size={32} />
            Lembretes
          </h2>
          <p className="text-slate-500 font-medium mt-1">Gerencie e envie mensagens rápidas para suas clientes.</p>
        </div>
        <button
          onClick={() => {
            setEditingReminder({ titulo: '', mensagem: '' });
            setIsEditModalOpen(true);
          }}
          className="bg-pink-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Novo Lembrete
        </button>
      </div>

      {/* Grid de Lembretes */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Carregando seus lembretes...</p>
        </div>
      ) : reminders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reminders.map(r => (
            <div key={r.id} className="group bg-white rounded-[2.5rem] border-2 border-slate-100 p-6 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-100/20 transition-all flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles size={24} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingReminder(r);
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ open: true, id: r.id, title: r.titulo })}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-3 line-clamp-1">{r.titulo}</h3>
              <p className="text-sm text-slate-500 font-medium mb-6 flex-1 line-clamp-4 leading-relaxed italic">
                "{r.mensagem}"
              </p>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                <button
                  onClick={() => {
                    setSelectedReminder(r);
                    setIsSendModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-pink-50 text-pink-600 rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-pink-100 transition-all active:scale-95"
                >
                  <User size={14} />
                  Individual
                </button>
                <button
                  onClick={() => handleSendMulti(r)}
                  className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-800 transition-all active:scale-95"
                >
                  <Users size={14} />
                  Múltiplo
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-20 text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Nenhum lembrete ainda</h3>
          <p className="text-slate-500 font-medium mb-8">Crie mensagens personalizadas para facilitar seu contato via WhatsApp.</p>
          <button
            onClick={() => {
              setEditingReminder({ titulo: '', mensagem: '' });
              setIsEditModalOpen(true);
            }}
            className="text-pink-600 font-black uppercase tracking-widest text-xs flex items-center gap-2 mx-auto hover:underline"
          >
            <Plus size={16} strokeWidth={3} />
            Criar meu primeiro lembrete
          </button>
        </div>
      )}

      {/* Modal de Edição/Criação */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSave} className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    {editingReminder.id ? 'Editar Lembrete' : 'Novo Lembrete'}
                  </h3>
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Título do Lembrete</label>
                    <input 
                      required
                      type="text"
                      value={editingReminder.titulo}
                      onChange={e => setEditingReminder({...editingReminder, titulo: e.target.value})}
                      placeholder="Ex: Pós-Procedimento Cílios"
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-slate-700 shadow-inner"
                    />
                  </div>

                  <div>
                    <div className="flex flex-col gap-3 mb-3 ml-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Variáveis Inteligentes (Clique para inserir)</label>
                        <button
                          type="button"
                          onClick={() => setShowExamples(!showExamples)}
                          className="flex items-center gap-1.5 text-pink-600 font-black uppercase tracking-widest text-[9px] hover:bg-pink-50 px-2 py-1 rounded-lg transition-all border border-pink-100"
                        >
                          <Info size={12} strokeWidth={3} />
                          Exemplos de Uso
                        </button>
                      </div>

                      <AnimatePresence>
                        {showExamples && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4 space-y-3">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Como usar as variáveis:</p>
                              
                              <div className="space-y-3">
                                <div>
                                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight mb-1">Pós-Procedimento:</p>
                                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic bg-white p-2 rounded-xl border border-slate-100">
                                    "Olá {"{nome}"}! Como está o resultado do seu {"{serviço}"} realizado no dia {"{data}"}? Equipe {"{estética}"} ✨"
                                  </p>
                                </div>
                                
                                <div>
                                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight mb-1">Promoção / Aviso:</p>
                                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic bg-white p-2 rounded-xl border border-slate-100">
                                    "Oi {"{nome}"}! Temos uma novidade aqui na {"{estética}"} para você que já realizou {"{serviço}"} com a gente!"
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-wrap gap-2">
                        {[
                          { tag: '{nome}', label: 'Nome da Cliente' },
                          { tag: '{serviço}', label: 'Último Serviço' },
                          { tag: '{data}', label: 'Data da Visita' },
                          { tag: '{estética}', label: 'Nome da Estética' }
                        ].map(v => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => {
                              const textarea = document.getElementById('reminder-message-textarea');
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const text = editingReminder.mensagem;
                              const before = text.substring(0, start);
                              const after = text.substring(end);
                              const newText = before + v.tag + after;
                              setEditingReminder({ ...editingReminder, mensagem: newText });
                              setTimeout(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start + v.tag.length, start + v.tag.length);
                              }, 0);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-black uppercase tracking-widest text-[8px] hover:border-pink-300 hover:text-pink-600 transition-all shadow-sm"
                          >
                            <Plus size={10} strokeWidth={3} />
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      id="reminder-message-textarea"
                      required
                      rows={6}
                      value={editingReminder.mensagem}
                      onChange={e => setEditingReminder({...editingReminder, mensagem: e.target.value})}
                      placeholder="Olá {nome}! Passando para lembrar dos cuidados do seu {serviço}..."
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-slate-700 shadow-inner resize-none"
                    />
                    <p className="mt-2 ml-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      As variáveis serão trocadas pelos dados reais no <span className="text-pink-500">envio individual</span>.
                    </p>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full mt-8 py-5 bg-pink-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 active:scale-95"
                >
                  Salvar Lembrete
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Envio Individual (Seleção de Cliente) */}
      <AnimatePresence>
        {isSendModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSendModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center">
                      <User size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Enviar para Cliente</h3>
                      <p className="text-sm text-slate-500 font-medium">Selecione para quem deseja enviar o lembrete.</p>
                    </div>
                  </div>
                  <button onClick={() => setIsSendModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar cliente..."
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-slate-700 shadow-inner text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {filteredClients.map(client => (
                  <button
                    key={client.user_id || client.user_telefone}
                    onClick={() => handleSendIndividual(client, selectedReminder)}
                    className="w-full p-4 hover:bg-pink-50 rounded-2xl flex items-center justify-between group transition-all border-2 border-transparent hover:border-pink-100"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 uppercase text-xs tracking-tight">{client.user_nome}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{client.user_telefone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-pink-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Enviar
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setIsSendModalOpen(false)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Exclusão */}
      <AnimatePresence>
        {deleteConfirm.open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm({ open: false, id: null, title: '' })}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Excluir Lembrete?</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                Tem certeza que deseja excluir o lembrete <span className="font-black text-slate-800">"{deleteConfirm.title}"</span>?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95"
                >
                  Sim, Excluir
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: false, id: null, title: '' })}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
