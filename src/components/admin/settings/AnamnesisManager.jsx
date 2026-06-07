import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Pencil, 
  ChevronRight, 
  Save, 
  X, 
  GripVertical, 
  CheckCircle2, 
  FileText,
  Settings2,
  AlertCircle,
  Layout,
  Sparkles,
  Eye,
  Check,
  Share2,
  Search,
  User,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { anamnesisService } from '../../../services/anamnesisService';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PREDEFINED_TEMPLATES = [
  {
    id: 'sobrancelhas',
    nome: 'Design de Sobrancelhas & Facial',
    descricao: 'Modelo baseado na ficha profissional para design, coloração e tratamentos faciais.',
    perguntas: [
      { id: '1', tipo: 'multiple_choice', enunciado: 'Tipo de Pele (Biotipo Cutâneo)', opcoes: ['Oleosa', 'Mista', 'Seca', 'Normal'], obrigatoria: true },
      { id: '2', tipo: 'multiple_choice', enunciado: 'Características da Pele', opcoes: ['Acne', 'Cicatriz', 'Manchas', 'Normal'], obrigatoria: true },
      { id: '3', tipo: 'yes_no', enunciado: 'Apresenta psoríase ou caspa?', obrigatoria: true },
      { id: '4', tipo: 'yes_no_with_text', enunciado: 'Já apresentou alergia a algum tipo de cosmético?', obrigatoria: true },
      { id: '5', tipo: 'yes_no_with_text', enunciado: 'Possui alergia a algum componente químico?', obrigatoria: true },
      { id: '6', tipo: 'yes_no_with_text', enunciado: 'Utiliza ácido ou produtos de descamação da pele?', obrigatoria: true },
      { id: '7', tipo: 'yes_no_with_text', enunciado: 'Uso diário de medicamentos?', obrigatoria: true },
      { id: '8', tipo: 'yes_no', enunciado: 'Está gestante ou amamentando?', obrigatoria: true },
      { id: '9', tipo: 'yes_no', enunciado: 'Possui queda de pelos?', obrigatoria: true }
    ]
  },
  {
    id: 'depilacao',
    nome: 'Depilação & Avaliação Geral',
    descricao: 'Modelo padrão para procedimentos de depilação e cuidados com a pele.',
    perguntas: [
      { id: '1', tipo: 'yes_no', enunciado: 'Já fez depilação antes?', obrigatoria: true },
      { id: '2', tipo: 'yes_no_with_text', enunciado: 'Tem alergia a algum cosmético ou medicamento?', obrigatoria: true },
      { id: '3', tipo: 'yes_no_with_text', enunciado: 'Possui problemas de pele?', obrigatoria: true },
      { id: '4', tipo: 'yes_no_with_text', enunciado: 'Está em tratamento dermatológico?', obrigatoria: true },
      { id: '5', tipo: 'multiple_choice', enunciado: 'Qual seu tipo de pele?', opcoes: ['Oleosa', 'Normal', 'Seca'], obrigatoria: true },
      { id: '6', tipo: 'yes_no_with_text', enunciado: 'Está grávida?', obrigatoria: true },
      { id: '7', tipo: 'yes_no_with_text', enunciado: 'Faz uso de algum medicamento diário?', obrigatoria: true },
      { id: '8', tipo: 'yes_no_with_text', enunciado: 'Realizou alguma cirurgia recente?', obrigatoria: true },
      { id: '9', tipo: 'yes_no_with_text', enunciado: 'Possui foliculite?', obrigatoria: true },
      { id: '10', tipo: 'yes_no_with_text', enunciado: 'Algum outro problema que seja necessário nos informar?', obrigatoria: false }
    ]
  }
];

const QUESTION_TYPES = [
  { id: 'text', label: 'Resposta Curta', icon: Layout },
  { id: 'long_text', label: 'Resposta Longa', icon: FileText },
  { id: 'yes_no', label: 'Sim ou Não', icon: CheckCircle2 },
  { id: 'yes_no_with_text', label: 'Sim/Não + Texto', icon: MessageSquare },
  { id: 'multiple_choice', label: 'Múltipla Escolha', icon: Settings2 }
];

export default function AnamnesisManager({ establishment, user, allAppointments = [] }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPredefinedCards, setShowPredefinedCards] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState(null);
  
  // Estados para envio
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchAppointment, setSearchAppointment] = useState('');
  const [recentResponses, setRecentResponses] = useState({}); // { [customerId]: latestResponseDate }
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Estado para exclusão personalizada
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, nome: '' });

  useEffect(() => {
    if (establishment?.id) {
      loadTemplates();
    }
  }, [establishment?.id]);

  useEffect(() => {
    if (isSendModalOpen && establishment?.id && selectedTemplate?.id) {
      loadRecentResponses();
    }
  }, [isSendModalOpen, establishment?.id, selectedTemplate?.id]);

  const loadRecentResponses = async () => {
    setLoadingResponses(true);
    try {
      // Busca todas as respostas do estabelecimento para este template
      const responses = await anamnesisService.getResponsesByTemplate(establishment.id, selectedTemplate.id);
      
      const responsesMap = {};
      responses.forEach(resp => {
        const date = resp.createdAt?.toDate ? resp.createdAt.toDate() : new Date(resp.createdAt);
        const customerKey = resp.customer_id;
        
        if (!responsesMap[customerKey] || date > responsesMap[customerKey]) {
          responsesMap[customerKey] = date;
        }
      });
      setRecentResponses(responsesMap);
    } catch (error) {
      console.error("Erro ao carregar respostas recentes:", error);
    } finally {
      setLoadingResponses(false);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    const data = await anamnesisService.getTemplates(establishment.id);
    setTemplates(data || []);
    setLoading(false);
  };

  const handleCreateNew = () => {
    setShowPredefinedCards(true);
  };

  const startBlank = () => {
    setEditingTemplate({
      nome: '',
      descricao: '',
      perguntas: [
        { id: Date.now().toString(), tipo: 'text', enunciado: '', obrigatoria: true }
      ]
    });
    setShowPredefinedCards(false);
    setIsModalOpen(true);
  };

  const usePredefined = (preTemplate) => {
    setEditingTemplate({
      ...preTemplate,
      id: null // Garante que será um novo documento ao salvar
    });
    setShowPredefinedCards(false);
    setPreviewingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate({ ...template });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    const { id } = deleteConfirm;
    if (!id) return;
    
    try {
      await anamnesisService.deleteTemplate(id);
      setDeleteConfirm({ open: false, id: null, nome: '' });
      loadTemplates();
    } catch (error) {
      console.error("Erro ao deletar:", error);
      alert("Erro ao excluir modelo.");
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!editingTemplate.nome) return alert("O nome da ficha é obrigatório.");
    
    try {
      await anamnesisService.saveTemplate(establishment.id, editingTemplate);
      setIsModalOpen(false);
      loadTemplates();
    } catch (error) {
      alert("Erro ao salvar modelo.");
    }
  };

  const filteredClients = React.useMemo(() => {
    const clientsMap = new Map();
    
    // Agrupa agendamentos por cliente e pega o mais recente/próximo
    allAppointments.forEach(app => {
      if (!app.user_id && !app.user_telefone) return;
      const key = app.user_id || app.user_telefone;
      
      const appDate = app.data_hora?.seconds ? new Date(app.data_hora.seconds * 1000) : new Date(app.data_hora);
      const existing = clientsMap.get(key);
      
      if (!existing) {
        clientsMap.set(key, {
          user_id: app.user_id,
          user_nome: app.user_nome,
          user_telefone: app.user_telefone,
          latest_appointment_id: app.id,
          latest_date: appDate,
          service_nome: app.service_nome
        });
      } else {
        // Se este agendamento for mais recente, atualiza
        if (appDate > existing.latest_date) {
          clientsMap.set(key, {
            ...existing,
            latest_appointment_id: app.id,
            latest_date: appDate,
            service_nome: app.service_nome
          });
        }
      }
    });

    const search = searchAppointment.toLowerCase();
    return Array.from(clientsMap.values())
      .filter(client => 
        client.user_nome?.toLowerCase().includes(search) || 
        client.user_telefone?.includes(search)
      )
      .sort((a, b) => b.latest_date - a.latest_date)
      .slice(0, 20);
  }, [allAppointments, searchAppointment]);

  const handleSendToClient = (client, template) => {
    if (!client || !template || !establishment?.slug) return;
    
    // Formata o telefone
    let phone = client.user_telefone || '';
    const cleaned = phone.replace(/\D/g, '');
    const formattedPhone = cleaned.length >= 10 ? (cleaned.startsWith('55') ? cleaned : `55${cleaned}`) : '';

    if (!formattedPhone) {
      alert("Este cliente não possui um telefone válido cadastrado.");
      return;
    }

    const baseUrl = window.location.origin;
    const formUrl = `${baseUrl}/${establishment.slug}/anamnese/${client.latest_appointment_id}?templateId=${template.id}`;
    
    const message = encodeURIComponent(`Olá ${client.user_nome}! ✨ Para melhor atendê-la, pedimos que preencha sua ficha de anamnese antes do seu atendimento: ${formUrl}`);
    
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
    setIsSendModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Fichas de Anamnese</h2>
          <p className="text-gray-500 font-medium">Gerencie seus modelos de avaliação para clientes.</p>
        </div>
        {user?.tipo === 'admin' && (
          <button 
            onClick={handleCreateNew}
            className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <Plus size={16} strokeWidth={3} />
            Novo Modelo
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
          <div className="w-10 h-10 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Carregando modelos...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
            <ClipboardList size={40} />
          </div>
          <p className="text-gray-400 font-medium">Nenhum modelo de anamnese criado ainda.</p>
          <button onClick={handleCreateNew} className="mt-4 text-pink-600 font-bold text-sm hover:underline">
            Criar sua primeira ficha agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-4">
                  <ClipboardList size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(t)} className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all">
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirm({ open: true, id: t.id, nome: t.nome })} 
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-gray-800 text-lg uppercase tracking-tight truncate">{t.nome}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2 min-h-[2.5rem]">{t.descricao || 'Sem descrição.'}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  {t.perguntas?.length || 0} Perguntas
                </span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setSelectedTemplate(t);
                      setIsSendModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-pink-600 font-black uppercase tracking-widest text-[9px] bg-pink-50 px-3 py-1.5 rounded-lg hover:bg-pink-100 transition-all"
                  >
                    <Share2 size={12} />
                    Enviar
                  </button>
                  <button onClick={() => handleEdit(t)} className="text-slate-400 font-black uppercase tracking-widest text-[9px] flex items-center gap-1 hover:text-pink-600 hover:underline">
                    Editar <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE ENVIO DE FICHA */}
      <AnimatePresence>
        {isSendModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                      <Share2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Enviar Ficha</h3>
                      <p className="text-sm text-slate-500 font-medium">Selecione a cliente para enviar a ficha.</p>
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
                    placeholder="Buscar cliente por nome ou telefone..."
                    value={searchAppointment}
                    onChange={(e) => setSearchAppointment(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-slate-700 shadow-inner text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                {loadingResponses ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verificando fichas preenchidas...</p>
                  </div>
                ) : filteredClients.length > 0 ? (
                  filteredClients.map(client => {
                    const customerKey = client.user_id || client.user_telefone;
                    const lastResponseDate = recentResponses[customerKey];
                    const isFilled = !!lastResponseDate;
                    
                    // Verifica se foi preenchido há menos de 24h
                    const isWithin24h = isFilled && (new Date() - lastResponseDate < 24 * 60 * 60 * 1000);

                    // Se foi preenchido e já passou de 24h, a cliente "some" da lista de envio
                    // (mantendo a lista limpa apenas com quem ainda não preencheu ou preencheu muito recentemente)
                    if (isFilled && !isWithin24h) return null; 

                    return (
                      <div
                        key={client.user_id || client.user_telefone}
                        className={`w-full p-4 rounded-2xl flex items-center justify-between group transition-all border-2 ${
                          isFilled 
                          ? 'bg-emerald-50/30 border-emerald-100 opacity-80' 
                          : 'hover:bg-pink-50 border-transparent hover:border-pink-100'
                        }`}
                      >
                        <div className="flex items-center gap-4 text-left">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isFilled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white'
                          }`}>
                            {isFilled ? <Check size={20} strokeWidth={3} /> : <User size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-800 uppercase text-xs tracking-tight">{client.user_nome}</p>
                              {isFilled && (
                                <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                                  Preenchido
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{client.service_nome}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Calendar size={12} />
                            {format(client.latest_date, "dd/MM", { locale: ptBR })}
                          </div>
                          
                          {isFilled ? (
                            <div className="mt-1 text-emerald-600 font-black text-[8px] uppercase tracking-widest flex items-center justify-end gap-1">
                              <CheckCircle2 size={10} />
                              Já Respondeu
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSendToClient(client, selectedTemplate)}
                              className="flex items-center justify-end gap-1.5 mt-1 text-pink-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MessageSquare size={12} />
                              Enviar Whats
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma cliente encontrada.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setIsSendModalOpen(false)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO PERSONALIZADO */}
      <AnimatePresence>
        {deleteConfirm.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm({ open: false, id: null, nome: '' })}
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
              
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Excluir Ficha?</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                Tem certeza que deseja excluir a ficha <span className="font-black text-slate-800">"{deleteConfirm.nome}"</span>? Esta ação não pode ser desfeita.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-100 active:scale-95"
                >
                  Sim, Excluir Ficha
                </button>
                <button
                  onClick={() => setDeleteConfirm({ open: false, id: null, nome: '' })}
                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE SELEÇÃO DE MODELO / NOVO */}
      <AnimatePresence>
        {showPredefinedCards && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPredefinedCards(false);
                setPreviewingTemplate(null);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl bg-slate-50 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Lado Esquerdo: Opções de Modelos */}
              <div className="flex-1 p-6 sm:p-10 overflow-y-auto no-scrollbar border-r border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Novo Modelo</h3>
                    <p className="text-sm text-slate-500 font-medium">Escolha como deseja começar sua ficha.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowPredefinedCards(false);
                      setPreviewingTemplate(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Opção em Branco */}
                  <button 
                    onClick={startBlank}
                    className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] text-left hover:border-pink-300 hover:shadow-xl hover:shadow-pink-50 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-pink-50 group-hover:text-pink-600 transition-colors">
                        <Plus size={28} strokeWidth={3} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight">Criar do Zero</h4>
                        <p className="text-xs text-slate-500 font-medium">Comece com uma ficha limpa e crie suas perguntas.</p>
                      </div>
                    </div>
                  </button>

                  <div className="py-4 flex items-center gap-4">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ou use um modelo pronto</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  {/* Modelos Prontos */}
                  <div className="grid grid-cols-1 gap-4">
                    {PREDEFINED_TEMPLATES.map(model => (
                      <div 
                        key={model.id}
                        className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative group ${
                          previewingTemplate?.id === model.id 
                          ? 'bg-pink-50 border-pink-500 shadow-xl shadow-pink-100' 
                          : 'bg-white border-slate-100 hover:border-pink-200'
                        }`}
                        onClick={() => setPreviewingTemplate(model)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                              previewingTemplate?.id === model.id ? 'bg-pink-500 text-white' : 'bg-slate-50 text-slate-400'
                            }`}>
                              <Sparkles size={24} />
                            </div>
                            <div>
                              <h4 className={`font-black uppercase tracking-tight ${previewingTemplate?.id === model.id ? 'text-pink-900' : 'text-slate-800'}`}>
                                {model.nome}
                              </h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{model.perguntas.length} Perguntas Sugeridas</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewingTemplate(model);
                              }}
                              className={`p-2 rounded-xl transition-all ${
                                previewingTemplate?.id === model.id ? 'bg-pink-100 text-pink-600' : 'bg-slate-50 text-slate-400 hover:bg-pink-50 hover:text-pink-600'
                              }`}
                            >
                              <Eye size={18} />
                            </button>
                            {previewingTemplate?.id === model.id && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  usePredefined(model);
                                }}
                                className="bg-pink-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg shadow-pink-200 animate-in zoom-in-95 duration-300"
                              >
                                Usar este
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lado Direito: Visualização Prévia */}
              <div className="hidden md:flex flex-[0.8] bg-slate-50 p-10 flex-col">
                {previewingTemplate ? (
                  <motion.div 
                    key={previewingTemplate.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="h-full flex flex-col"
                  >
                    <div className="mb-6">
                      <span className="bg-pink-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Preview</span>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-3">{previewingTemplate.nome}</h4>
                      <p className="text-sm text-slate-500 font-medium mt-1">{previewingTemplate.descricao}</p>
                    </div>

                    <div className="flex-1 bg-white rounded-[2rem] p-6 border-2 border-slate-100 overflow-y-auto no-scrollbar space-y-5 shadow-inner">
                      {previewingTemplate.perguntas.map((q, i) => (
                        <div key={i} className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            Pergunta {i + 1} 
                            {q.obrigatoria && <span className="text-pink-500">*</span>}
                          </p>
                          <p className="text-sm font-bold text-slate-700 leading-tight">{q.enunciado}</p>
                          <div className="h-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center px-3">
                            <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                              {q.tipo === 'yes_no' ? 'Sim / Não' : q.tipo === 'yes_no_with_text' ? 'Sim / Não + Detalhes' : q.tipo === 'multiple_choice' ? 'Múltipla Escolha' : 'Texto'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => usePredefined(previewingTemplate)}
                      className="w-full mt-6 bg-slate-900 text-white p-5 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-pink-600 transition-all flex items-center justify-center gap-3"
                    >
                      <Check size={20} strokeWidth={3} />
                      Confirmar e Importar Modelo
                    </button>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-200 text-slate-400 rounded-[2rem] flex items-center justify-center">
                      <ClipboardList size={40} />
                    </div>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest max-w-[200px]">Selecione um modelo ao lado para visualizar</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DO CONSTRUTOR */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Header do Modal */}
              <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {editingTemplate.id ? 'Editar Modelo' : 'Novo Modelo de Ficha'}
                    </h3>
                    <p className="text-sm text-gray-400 font-medium">Monte as perguntas da sua anamnese.</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                  <X size={24} />
                </button>
              </div>

              {/* Corpo do Modal */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome da Ficha</label>
                    <input 
                      type="text"
                      required
                      value={editingTemplate.nome}
                      onChange={e => setEditingTemplate({ ...editingTemplate, nome: e.target.value })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                      placeholder="Ex: Anamnese Facial, Avaliação Corporal..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Descrição (Opcional)</label>
                    <input 
                      type="text"
                      value={editingTemplate.descricao}
                      onChange={e => setEditingTemplate({ ...editingTemplate, descricao: e.target.value })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                      placeholder="Breve explicação para a cliente."
                    />
                  </div>
                </div>

                {/* Lista de Perguntas */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Perguntas</h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      {editingTemplate.perguntas.length} itens
                    </span>
                  </div>

                  <div className="space-y-4">
                    {editingTemplate.perguntas.map((q, idx) => (
                      <div key={q.id} className="p-6 bg-white border-2 border-slate-50 rounded-[2rem] shadow-sm relative group">
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical size={20} className="text-slate-200 cursor-move" />
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          <div className="lg:col-span-7 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input 
                                type="text"
                                required
                                value={q.enunciado}
                                onChange={e => {
                                  const newPerguntas = [...editingTemplate.perguntas];
                                  newPerguntas[idx].enunciado = e.target.value;
                                  setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                                }}
                                className="w-full bg-transparent border-none outline-none font-bold text-slate-800 placeholder:text-slate-300"
                                placeholder="Digite sua pergunta aqui..."
                              />
                            </div>
                          </div>

                          <div className="lg:col-span-3">
                            <select 
                              value={q.tipo}
                              onChange={e => {
                                const newPerguntas = [...editingTemplate.perguntas];
                                newPerguntas[idx].tipo = e.target.value;
                                if (e.target.value === 'multiple_choice' && !newPerguntas[idx].opcoes) {
                                  newPerguntas[idx].opcoes = ['Opção 1'];
                                }
                                setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                              }}
                              className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-pink-300"
                            >
                              {QUESTION_TYPES.map(type => (
                                <option key={type.id} value={type.id}>{type.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="lg:col-span-2 flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              onClick={() => {
                                const newPerguntas = editingTemplate.perguntas.filter((_, i) => i !== idx);
                                setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Opções extras para Múltipla Escolha */}
                        {q.tipo === 'multiple_choice' && (
                          <div className="mt-4 pl-8 space-y-2">
                            {q.opcoes?.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-pink-300" />
                                <input 
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const newPerguntas = [...editingTemplate.perguntas];
                                    newPerguntas[idx].opcoes[optIdx] = e.target.value;
                                    setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                                  }}
                                  className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-slate-600"
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newPerguntas = [...editingTemplate.perguntas];
                                    newPerguntas[idx].opcoes = newPerguntas[idx].opcoes.filter((_, i) => i !== optIdx);
                                    setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                                  }}
                                  className="text-slate-300 hover:text-red-400"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button"
                              onClick={() => {
                                const newPerguntas = [...editingTemplate.perguntas];
                                if (!newPerguntas[idx].opcoes) newPerguntas[idx].opcoes = [];
                                newPerguntas[idx].opcoes.push(`Opção ${newPerguntas[idx].opcoes.length + 1}`);
                                setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                              }}
                              className="text-[9px] font-black uppercase tracking-widest text-pink-600 hover:underline flex items-center gap-1 mt-2"
                            >
                              <Plus size={12} /> Adicionar Opção
                            </button>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={q.obrigatoria}
                              onChange={e => {
                                const newPerguntas = [...editingTemplate.perguntas];
                                newPerguntas[idx].obrigatoria = e.target.checked;
                                setEditingTemplate({ ...editingTemplate, perguntas: newPerguntas });
                              }}
                              className="w-4 h-4 rounded border-slate-200 text-pink-600 focus:ring-pink-500"
                            />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Obrigatória</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      setEditingTemplate({
                        ...editingTemplate,
                        perguntas: [...editingTemplate.perguntas, { id: Date.now().toString(), tipo: 'text', enunciado: '', obrigatoria: true }]
                      });
                    }}
                    className="w-full py-4 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 hover:text-pink-600 hover:border-pink-100 hover:bg-pink-50/30 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
                  >
                    <Plus size={16} /> Adicionar Nova Pergunta
                  </button>
                </div>
              </form>

              {/* Footer do Modal */}
              <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 flex items-center gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Salvar Modelo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
