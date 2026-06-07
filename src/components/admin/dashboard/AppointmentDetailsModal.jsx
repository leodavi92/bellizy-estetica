import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Phone, 
  Calendar, 
  Clock, 
  DollarSign, 
  MessageSquare, 
  CheckCircle, 
  Trash2,
  User,
  Sparkles,
  Info,
  AlertCircle,
  FileText,
  Pencil,
  Scissors,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CalendarDays,
  Printer,
  Share2,
  Receipt,
  Download,
  ClipboardList
} from 'lucide-react';
import { 
  format, 
  addMinutes, 
  isAfter, 
  startOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { getAvailableSlots, getMultiProfessionalAvailableSlots, APPOINTMENT_STATUS, normalizeStatus } from '../../../services/appointmentService';
import { anamnesisService } from '../../../services/anamnesisService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const AppointmentDetailsModal = ({ isOpen, onClose, appointment, onCancel, onComplete, establishment, onReschedule, allProfessionals = [], onUpdateAppointment, allAppointments = [] }) => {
  const [confirmAction, setConfirmAction] = useState(null);
  const [editMode, setEditMode] = useState(null); // 'menu', 'remarcar', 'remover', 'profissional'
  const [paymentMethod, setPaymentMethod] = useState('pix'); // 'dinheiro', 'pix', 'credito', 'debito'

  const safeToDate = (d) => {
    if (!d) return new Date();
    let date;
    if (d.toDate && typeof d.toDate === 'function') {
      date = d.toDate();
    } else if (d.seconds) {
      date = new Date(d.seconds * 1000);
    } else if (typeof d === 'string') {
      date = new Date(d);
    } else if (d instanceof Date) {
      date = d;
    } else {
      date = new Date(d);
    }
    
    return isNaN(date.getTime()) ? new Date() : date;
  };
  
  // Estados para o fluxo de remarcação interno
  const [reschedulingStep, setReschedulingStep] = useState('start'); // 'start', 'calendar', 'time', 'confirm'
  const [reschedulingDate, setReschedulingDate] = useState(new Date());
  const [reschedulingSlots, setReschedulingSlots] = useState([]);
  const [reschedulingLoadingSlots, setReschedulingLoadingSlots] = useState(false);
  const [reschedulingCurrentMonth, setReschedulingCurrentMonth] = useState(new Date());
  const [reschedulingNewSlot, setReschedulingNewSlot] = useState(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Estados para troca de profissional e remoção
  const [selectedServiceIdx, setSelectedServiceIdx] = useState(null);
  const [selectedNewProf, setSelectedNewProf] = useState(null);
  const [editStep, setEditStep] = useState('select_service'); // 'select_service', 'select_prof', 'checking', 'unavailable', 'confirm'
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [viewMode, setViewMode] = useState('details'); // 'details', 'receipt'
  const [isDownloading, setIsDownloading] = useState(false);
  const receiptRef = React.useRef(null);

  // Efeito para resetar estados ao mudar de modo
  React.useEffect(() => {
    setReschedulingStep('start');
    setSelectedServiceIdx(null);
    setSelectedNewProf(null);
    setEditStep('select_service');
    setViewMode('details');
  }, [editMode, appointment?.id]);

  const handleDownloadPDF = async () => {
     if (!receiptRef.current) return;
     setIsDownloading(true);
     try {
       const element = receiptRef.current;
       
       // Opções para capturar o conteúdo completo, mesmo o que está fora do scroll
       const canvas = await html2canvas(element, {
         scale: 3, // Aumenta a qualidade
         useCORS: true,
         backgroundColor: "#ffffff",
         scrollY: -window.scrollY, // Corrige problemas de posição se a página tiver scroll
         onclone: (clonedDoc) => {
           // No clone, removemos as restrições de altura e scroll para capturar tudo
           const clonedElement = clonedDoc.querySelector('[ref-receipt-content]');
           if (clonedElement) {
             clonedElement.style.height = 'auto';
             clonedElement.style.maxHeight = 'none';
             clonedElement.style.overflow = 'visible';
           }
         }
       });

       const imgData = canvas.toDataURL('image/png');
       
       // Calculamos a altura do PDF baseada na altura da imagem capturada
       const canvasWidth = canvas.width;
       const canvasHeight = canvas.height;
       const pdfWidth = 80; // Largura fixa de 80mm
       const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

       const pdf = new jsPDF({
         orientation: 'portrait',
         unit: 'mm',
         format: [pdfWidth, pdfHeight + 10] // Altura dinâmica com margem
       });
       
       pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, pdfHeight);
       pdf.save(`recibo-${appointment.user_nome}.pdf`);
     } catch (error) {
       console.error('Erro ao gerar PDF:', error);
     } finally {
       setIsDownloading(false);
     }
   };

  // Lógica para verificar disponibilidade do profissional
  const checkProfessionalAvailability = async (profId, serviceIdx) => {
    setEditStep('checking');
    
    console.log("Iniciando checagem de disponibilidade...");
    console.log("Total de agendamentos para conferir:", allAppointments.length);
    
    // Pequeno delay para a animação de "Verificando..."
    await new Promise(resolve => setTimeout(resolve, 800));

    const currentAppDate = safeToDate(appointment.data_hora);
    const service = appointment.services ? appointment.services[serviceIdx] : { duracao: appointment.duration };
    
    // Calcula o intervalo de tempo do serviço específico que estamos tentando trocar
    let serviceStart = currentAppDate.getTime();
    if (appointment.services && serviceIdx > 0) {
      let offset = 0;
      for (let i = 0; i < serviceIdx; i++) {
        offset += Number(appointment.services[i].duracao || appointment.services[i].duration || 30);
      }
      serviceStart = addMinutes(currentAppDate, offset).getTime();
    }
    const duration = Number(service.duracao || service.duration || 30);
    const serviceEnd = serviceStart + (duration * 60 * 1000);

    console.log(`Verificando conflito para Profissional: ${profId}`);
    console.log(`Intervalo do serviço: ${new Date(serviceStart).toLocaleString()} até ${new Date(serviceEnd).toLocaleString()}`);

    // Verifica conflitos com todos os agendamentos ativos da estética
    const conflictApp = allAppointments.find(app => {
      // Pula o próprio agendamento que estamos editando
      if (app.id === appointment.id) return false;
      
      // Pula agendamentos cancelados
      if (normalizeStatus(app.status) === APPOINTMENT_STATUS.CANCELLED) return false;

      // Verifica se o profissional que queremos colocar está ocupado neste outro agendamento
      // Ele pode ser o profissional principal OU estar em algum serviço do combo
      const isProfInRoot = (app.professional_id || 'owner') === profId;
      const isProfInServices = app.services && Array.isArray(app.services) && 
                              app.services.some(s => (s.professional_id || 'owner') === profId);
      
      if (!isProfInRoot && !isProfInServices) return false;

      // Se o profissional está envolvido, agora checamos se o horário bate
      const appStart = safeToDate(app.data_hora).getTime();
      const appDur = Number(app.total_duration || app.duration || app.duracao || 30);
      const appEnd = appStart + (appDur * 60 * 1000);

      // Lógica de sobreposição: (Início A < Fim B) E (Fim A > Início B)
      const hasOverlap = (serviceStart < appEnd) && (serviceEnd > appStart);
      
      if (hasOverlap) {
        console.warn("CONFLITO REAL DETECTADO!");
        console.warn(`Agendamento Conflitante: ${app.user_nome} (${app.id})`);
        console.warn(`Horário do conflito: ${new Date(appStart).toLocaleString()} até ${new Date(appEnd).toLocaleString()}`);
      }
      
      return hasOverlap;
    });

    return !conflictApp;
  };

   // Lógica para gerar os dias do calendário
   const monthStart = startOfMonth(reschedulingCurrentMonth);
   const monthEnd = endOfMonth(monthStart);
   const calendarDays = eachDayOfInterval({
     start: startOfWeek(monthStart),
     end: endOfWeek(monthEnd)
   });

   // Efeito para carregar horários quando a data muda no modo remarcar
  React.useEffect(() => {
    if (editMode !== 'remarcar' || !appointment || !establishment) return;

    async function loadRescheduleSlots() {
      setReschedulingLoadingSlots(true);
      try {
        let slots = [];
        const serviceAssignments = (appointment.services || []).map(s => ({
          service: s,
          professionalId: s.professional_id || appointment.professional_id || 'owner'
        }));

        if (serviceAssignments.length > 0) {
          slots = await getMultiProfessionalAvailableSlots(reschedulingDate, serviceAssignments, establishment.id);
        } else {
          slots = await getAvailableSlots(reschedulingDate, appointment.duration || 30, establishment.id, appointment.professional_id || 'owner');
        }
        setReschedulingSlots(slots);
      } catch (error) {
        console.error("Erro ao carregar slots para remarcação:", error);
      } finally {
        setReschedulingLoadingSlots(false);
      }
    }

    loadRescheduleSlots();
  }, [editMode, reschedulingDate, appointment, establishment]);

  if (!appointment) return null;

  const checkRescheduleDayAvailability = (date) => {
    if (!establishment || !appointment) return false;
    if (isAfter(startOfDay(new Date()), startOfDay(date))) return false;

    const availabilityRules = establishment.availability_rules;
    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
    const dayConfig = availabilityRules ? availabilityRules[dayName] : null;

    if (dayConfig && !dayConfig.enabled) return false;

    if (!dayConfig) {
      const settings = establishment.settings || { horario_inicio: '08:00', horario_fim: '18:00' };
      const workingDays = settings.dias_trabalho || [1, 2, 3, 4, 5, 6];
      if (!workingDays.includes(date.getDay())) return false;
    }

    const blockedSlots = establishment.blocked_slots || [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBlock = blockedSlots.find(b => b.date === dateStr && b.start_time === "00:00" && b.end_time === "23:59");
    if (dayBlock) return false;

    return true;
  };

  const appDate = safeToDate(appointment.data_hora);
  
  // Busca o telefone em múltiplos campos possíveis para garantir compatibilidade
  const userPhone = appointment.user_telefone || 
                    appointment.user_phone || 
                    appointment.userPhone || 
                    appointment.userTelefone || 
                    appointment.telefone || 
                    appointment.phone || 
                    '';
  
  // Lógica corrigida para link do WhatsApp:
  const cleanPhone = userPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone 
    ? (cleanPhone.startsWith('55') && cleanPhone.length >= 12 ? cleanPhone : `55${cleanPhone}`)
    : '';
    
  const whatsappUrl = formattedPhone ? `https://wa.me/${formattedPhone}` : '#';
  const userAvatar = appointment.user_avatar || appointment.avatar_url || appointment.photoURL || '';

  // Nome do profissional consolidado
  const professionalName = appointment.professional_nome || '';

  const handleClose = () => {
    setConfirmAction(null);
    setEditMode(null);
    setReschedulingStep('start');
    setReschedulingNewSlot(null);
    setViewMode('details');
    onClose();
  };

  if (!appointment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative w-full max-w-md bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[650px] sm:h-[700px]"
          >
            {/* Header - Mobile First Layout */}
            <div className="relative bg-gradient-to-r from-pink-600 to-rose-500 p-4 sm:p-5 px-5 sm:px-6 flex flex-col justify-end min-h-[110px]">
              <div className="absolute top-3 right-3 flex gap-2">
                { (editMode || viewMode === 'receipt' || viewMode === 'anamnesis') && (
                  <button
                    onClick={() => {
                      if (viewMode === 'receipt' || viewMode === 'anamnesis') {
                        setViewMode('details');
                        return;
                      }
                      if (editMode === 'remarcar') {
                        if (reschedulingStep === 'confirm') {
                          setReschedulingStep('time');
                        } else if (reschedulingStep === 'time') {
                          setReschedulingStep('calendar');
                        } else if (reschedulingStep === 'calendar') {
                          setReschedulingStep('start');
                        } else {
                          setEditMode('menu');
                        }
                      } else if (editMode === 'profissional') {
                        if (editStep === 'confirm') {
                          setEditStep('select_prof');
                        } else if (editStep === 'select_prof') {
                          if (appointment.services && appointment.services.length > 1) {
                            setEditStep('select_service');
                          } else {
                            setEditMode('menu');
                          }
                        } else {
                          setEditMode('menu');
                        }
                      } else if (editMode === 'remover') {
                        if (editStep === 'confirm') {
                          setEditStep('select_service');
                        } else {
                          setEditMode('menu');
                        }
                      } else {
                        setEditMode(null);
                      }
                    }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors active:scale-90"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors active:scale-90"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white p-0.5 sm:p-1 shadow-xl shrink-0">
                  <div className="w-full h-full rounded-[0.5rem] sm:rounded-[0.8rem] bg-pink-50 flex items-center justify-center text-pink-600 overflow-hidden">
                    {userAvatar ? (
                      <img src={userAvatar} alt={appointment.user_nome} className="w-full h-full object-cover" />
                    ) : (
                      <User size="20" className="sm:size-24" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0 text-white">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight leading-tight truncate">{appointment.user_nome}</h3>
                  <p className="text-white/80 font-bold text-[10px] sm:text-xs flex items-center gap-1.5 mt-0.5">
                    <Phone size={10} className="text-pink-200" />
                    {userPhone ? userPhone : 'Sem telefone'}
                  </p>
                </div>
              </div>
            </div>

            {/* Ações Rápidas - Otimizadas para Toque no Mobile */}
            {!confirmAction && !editMode && viewMode === 'details' && (
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    if (!formattedPhone) return;
                    window.open(`https://wa.me/${formattedPhone}`, '_blank');
                  }}
                  disabled={!formattedPhone}
                  className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                    formattedPhone ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Phone size={16} strokeWidth={3} className="sm:size-18" />
                  <span>Whats</span>
                </button>
                
                <button
                  onClick={() => {
                    if (!formattedPhone) return;
                    const message = encodeURIComponent(`Olá ${appointment.user_nome}! ✨ Passando para confirmar seu agendamento de ${appointment.services ? appointment.services.map(s => s.nome).join(' + ') : appointment.service_nome} para ${format(appDate, "dd/MM 'às' HH:mm")}. Podemos confirmar?`);
                    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
                  }}
                  disabled={!formattedPhone}
                  className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                    formattedPhone ? 'bg-white border-2 border-green-500 text-green-600 hover:bg-green-50 shadow-green-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <MessageSquare size={16} strokeWidth={3} className="sm:size-18" />
                  <span>Lembrete</span>
                </button>
              </div>
            )}

            {/* Content - Layout Limpo e Responsivo */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 sm:p-6 relative scrollbar-hide">
              <AnimatePresence mode="wait">
                {viewMode === 'receipt' ? (
                  <motion.div
                    key="receipt-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col h-full"
                  >
                    {/* Estilo Cupom Fiscal */}
                    <div className="flex-1 bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                      <div className="p-6 space-y-6 flex-1 overflow-y-auto scrollbar-hide" ref={receiptRef} ref-receipt-content="true">
                        {/* Cabeçalho do Recibo */}
                        <div className="text-center space-y-2 border-b border-dashed border-slate-200 pb-6">
                          <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-2 text-pink-600">
                            <Receipt size={24} />
                          </div>
                          <h4 className="text-lg font-black uppercase tracking-tight text-slate-800">
                            {establishment?.nome || establishment?.name || appointment?.establishment_nome || 'Nome da Estética'}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            Recibo de Atendimento
                          </p>
                        </div>

                        {/* Detalhes do Cliente */}
                        <div className="space-y-3 py-2">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-400 uppercase">Cliente</span>
                            <span className="text-slate-800">{appointment.user_nome}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-400 uppercase">Data</span>
                            <span className="text-slate-800">{format(appDate, "dd/MM/yyyy")}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-400 uppercase">Horário</span>
                            <span className="text-slate-800">{format(appDate, "HH:mm")}</span>
                          </div>
                        </div>

                        {/* Lista de Serviços */}
                        <div className="space-y-4 border-t border-dashed border-slate-200 pt-6">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Serviços Realizados</h5>
                          <div className="space-y-3">
                            {appointment.services ? (
                              appointment.services.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-bold text-slate-800 leading-tight">{s.nome}</p>
                                    <p className="text-[9px] font-black text-pink-600 uppercase tracking-tight mt-0.5">
                                      Prof: {s.professional_nome || appointment.professional_nome}
                                    </p>
                                  </div>
                                  <span className="text-xs font-black text-slate-700">
                                    R$ {(s.preco || s.price || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="text-xs font-bold text-slate-800 leading-tight">{appointment.service_nome}</p>
                                  <p className="text-[9px] font-black text-pink-600 uppercase tracking-tight mt-0.5">
                                    Prof: {appointment.professional_nome}
                                  </p>
                                </div>
                                <span className="text-xs font-black text-slate-700">
                                  R$ {(appointment.preco || appointment.total_price || 0).toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Total */}
                        <div className="border-t-2 border-slate-800 border-dashed pt-6 mt-6">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black uppercase tracking-widest text-slate-800">Total</span>
                            <span className="text-2xl font-black text-slate-900">
                              R$ {(appointment.total_price || appointment.preco || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Rodapé do Cupom */}
                        <div className="text-center pt-8 pb-4">
                          <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
                            Obrigado pela preferência!<br />
                            Esperamos ver você em breve ✨
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação do Recibo */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                        <button
                          onClick={() => {
                            const servicesText = appointment.services 
                              ? appointment.services.map(s => `• ${s.nome}: R$ ${(s.preco || s.price || 0).toFixed(2)}`).join('%0A')
                              : `• ${appointment.service_nome}: R$ ${(appointment.preco || appointment.total_price || 0).toFixed(2)}`;
                            
                            const total = (appointment.total_price || appointment.preco || 0).toFixed(2);
                            const message = encodeURIComponent(`*RECIBO DE ATENDIMENTO*%0A*${establishment?.nome || 'Estética'}*%0A%0A*Cliente:* ${appointment.user_nome}%0A*Data:* ${format(appDate, "dd/MM/yyyy")} às ${format(appDate, "HH:mm")}%0A%0A*SERVIÇOS:*%0A${servicesText}%0A%0A*VALOR TOTAL:* R$ ${total}%0A%0A✨ _Obrigado pela preferência!_`);
                            
                            window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-green-100 hover:bg-green-600 transition-all active:scale-95"
                        >
                          <Share2 size={14} />
                          WhatsApp
                        </button>
                        <button
                          disabled={isDownloading}
                          onClick={handleDownloadPDF}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Download size={14} />
                          {isDownloading ? 'Baixando...' : 'Baixar PDF'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : editMode === 'menu' ? (
                  <motion.div
                    key="edit-menu"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1 mb-4">Ações de Edição</h4>
                    
                    <button
                      onClick={() => setEditMode('remarcar')}
                      className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-pink-50 border border-slate-100 hover:border-pink-200 rounded-3xl transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-pink-600 shadow-sm group-hover:bg-pink-600 group-hover:text-white transition-all">
                        <RefreshCw size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 uppercase text-sm tracking-tight">Remarcar Agendamento</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trocar data ou horário</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setEditMode('remover');
                        setEditStep('select_service');
                      }}
                      className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 rounded-3xl transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-red-500 shadow-sm group-hover:bg-red-500 group-hover:text-white transition-all">
                        <Scissors size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 uppercase text-sm tracking-tight">Remover Serviço</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cancelamento parcial do combo</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setEditMode('profissional');
                        if (appointment.services && appointment.services.length === 1) {
                          setSelectedServiceIdx(0);
                          setEditStep('select_prof');
                        } else if (!appointment.services && appointment.service_id) {
                          setSelectedServiceIdx(0);
                          setEditStep('select_prof');
                        } else {
                          setEditStep('select_service');
                        }
                      }}
                      className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-blue-50 border border-slate-100 border-blue-100 rounded-3xl transition-all group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-500 shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <Users size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 uppercase text-sm tracking-tight">Trocar Profissional</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alterar quem executa o serviço</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setEditMode(null)}
                      className="w-full py-4 mt-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
                    >
                      Voltar para Detalhes
                    </button>
                  </motion.div>
                ) : editMode === 'remarcar' ? (
                  <motion.div
                    key="edit-remarcar"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {reschedulingStep === 'start' ? (
                      <div className="space-y-6 text-center py-4">
                        <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <RefreshCw size={32} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Remarcar Horário</h3>
                          <p className="text-xs text-slate-500 font-medium px-4">
                            Para remarcar, vamos abrir o calendário para você escolher o novo horário. O agendamento atual será cancelado automaticamente após a nova reserva.
                          </p>
                        </div>
                        <button
                          onClick={() => setReschedulingStep('calendar')}
                          className="w-full py-4 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-pink-100 active:scale-95 transition-all"
                        >
                          Abrir Calendário
                        </button>
                        <button
                          onClick={() => setEditMode('menu')}
                          className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
                        >
                          Voltar
                        </button>
                      </div>
                    ) : reschedulingStep === 'calendar' ? (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 capitalize">
                            <CalendarDays size={18} className="text-pink-600" />
                            <span>{format(reschedulingCurrentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReschedulingCurrentMonth(subMonths(reschedulingCurrentMonth, 1))}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-pink-200 hover:text-pink-600"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setReschedulingCurrentMonth(addMonths(reschedulingCurrentMonth, 1))}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-pink-200 hover:text-pink-600"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day) => {
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isSelected = isSameDay(day, reschedulingDate);
                            const hasAvailability = isCurrentMonth && checkRescheduleDayAvailability(day);

                            return (
                              <button
                                key={day.toISOString()}
                                type="button"
                                disabled={!isCurrentMonth}
                                onClick={() => {
                                  setReschedulingDate(day);
                                  setReschedulingStep('time');
                                }}
                                className={`relative aspect-square rounded-xl text-xs font-bold transition-all ${
                                  !isCurrentMonth
                                    ? 'cursor-not-allowed text-transparent'
                                    : isSelected
                                      ? 'bg-slate-950 text-white shadow-lg shadow-slate-300/40'
                                      : hasAvailability
                                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                                        : 'border border-slate-200 bg-white text-slate-500 hover:border-pink-200 hover:text-pink-600'
                                }`}
                              >
                                <span>{format(day, 'd')}</span>
                                {isToday(day) && isCurrentMonth && (
                                  <span className="absolute left-1/2 top-1.5 h-1 w-1 -translate-x-1/2 rounded-full bg-pink-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : reschedulingStep === 'time' ? (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between bg-pink-50/50 p-4 rounded-2xl border border-pink-100">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Clock3 size={18} className="text-pink-600" />
                            <span>{format(reschedulingDate, "dd 'de' MMMM", { locale: ptBR })}</span>
                          </div>
                          <button 
                            onClick={() => setReschedulingStep('calendar')}
                            className="text-[10px] font-black uppercase tracking-widest text-pink-600 hover:text-pink-700"
                          >
                            Alterar Data
                          </button>
                        </div>

                        {reschedulingLoadingSlots ? (
                          <div className="grid grid-cols-3 gap-2">
                            {[...Array(9)].map((_, index) => (
                              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                            ))}
                          </div>
                        ) : reschedulingSlots.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-hide">
                            {reschedulingSlots.map((slot) => (
                              <button
                                key={slot.toISOString()}
                                type="button"
                                onClick={() => {
                                  setReschedulingNewSlot(slot);
                                  setReschedulingStep('confirm');
                                }}
                                className="rounded-xl border border-slate-100 bg-white px-2 py-3 text-xs font-black text-slate-700 transition-all hover:border-pink-300 hover:bg-pink-600 hover:text-white"
                              >
                                {format(slot, 'HH:mm')}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                            <p className="text-xs font-bold text-slate-400 leading-relaxed">
                              Nenhum horário disponível para esta data.
                            </p>
                            <button 
                              onClick={() => setReschedulingStep('calendar')}
                              className="mt-3 text-[10px] font-black uppercase tracking-widest text-pink-600"
                            >
                              Escolher outro dia
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-r from-pink-600 to-rose-500 p-6 rounded-[2rem] text-white text-center shadow-lg">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                            <RefreshCw size={24} className="animate-spin-slow" />
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight">Confirmar Troca</h3>
                          <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Revise antes de confirmar</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          {/* Horário Antigo */}
                          <div className="bg-red-50/50 border border-red-100 p-5 rounded-3xl opacity-60">
                            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2 flex items-center gap-2">
                              <Trash2 size={10} /> Horário Atual
                            </p>
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-bold text-slate-800">
                                {format(appDate, "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              <p className="text-xl font-black text-red-600">
                                {format(appDate, "HH:mm")}
                              </p>
                            </div>
                          </div>

                          {/* Novo Horário */}
                          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl shadow-sm ring-4 ring-emerald-50/50">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2 flex items-center gap-2">
                              <CheckCircle size={10} /> Novo Horário
                            </p>
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-bold text-slate-800">
                                {format(reschedulingNewSlot, "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              <p className="text-xl font-black text-emerald-600">
                                {format(reschedulingNewSlot, "HH:mm")}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            disabled={isRescheduling}
                            onClick={async () => {
                              setIsRescheduling(true);
                              try {
                                await onReschedule(appointment, reschedulingNewSlot);
                                handleClose();
                              } catch (error) {
                                console.error(error);
                              } finally {
                                setIsRescheduling(false);
                              }
                            }}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isRescheduling ? 'Processando...' : 'Confirmar Remarcação'}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : editMode === 'profissional' ? (
                  <motion.div
                    key="edit-profissional"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* Passo 1: Selecionar Serviço (se houver mais de um) */}
                    {editStep === 'select_service' && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Trocar de qual serviço?</h4>
                        <div className="space-y-2">
                          {(appointment.services || []).map((s, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedServiceIdx(idx);
                                setEditStep('select_prof');
                              }}
                              className="w-full flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-pink-200 hover:bg-pink-50 transition-all"
                            >
                              <div className="text-left">
                                <p className="text-sm font-bold text-slate-800">{s.nome}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                                  Atual: {s.professional_nome || appointment.professional_nome}
                                </p>
                              </div>
                              <ChevronRight size={18} className="text-slate-300" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Passo 2: Selecionar Novo Profissional (Filtrado) */}
                    {editStep === 'select_prof' && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                          Escolha o novo profissional
                        </h4>
                        <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-hide">
                          {allProfessionals
                            .filter(p => {
                              // Se for o dono (id: 'owner'), ele faz tudo
                              if (p.id === 'owner') return true;
                              
                              // Pega o serviço que estamos editando
                              const serviceToEdit = appointment.services 
                                ? appointment.services[selectedServiceIdx || 0] 
                                : { service_id: appointment.service_id };
                              
                              // Verifica se o profissional faz esse serviço
                              return p.servicos && Array.isArray(p.servicos) && p.servicos.includes(serviceToEdit.id || serviceToEdit.service_id);
                            })
                            .map(p => (
                              <button
                                key={p.id}
                                onClick={async () => {
                                  setSelectedNewProf(p);
                                  const isAvailable = await checkProfessionalAvailability(p.id, selectedServiceIdx || 0);
                                  if (isAvailable) {
                                    setEditStep('confirm');
                                  } else {
                                    setEditStep('unavailable');
                                  }
                                }}
                                className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-pink-200 hover:bg-pink-50 transition-all group"
                              >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                                  {p.foto ? (
                                    <img src={p.foto} alt={p.nome} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <User size={20} />
                                    </div>
                                  )}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-800 truncate group-hover:text-pink-600 transition-colors">{p.nome}</p>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.cargo}</p>
                                </div>
                                <ChevronRight size={18} className="text-slate-300 group-hover:text-pink-400 transition-colors" />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Tela de Verificando Disponibilidade */}
                    {editStep === 'checking' && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center text-pink-600">
                            <Clock size={32} />
                          </div>
                        </div>
                        <div className="text-center space-y-2">
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Verificando Agenda</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                            Consultando disponibilidade de {selectedNewProf?.nome}...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tela de Profissional Indisponível */}
                    {editStep === 'unavailable' && (
                      <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                          <AlertCircle size={40} />
                        </div>
                        <div className="space-y-2 px-4">
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Profissional Indisponível</h3>
                          <p className="text-sm font-medium text-slate-500">
                            Infelizmente, <strong>{selectedNewProf?.nome}</strong> já possui um agendamento neste horário.
                          </p>
                          <p className="text-xs font-bold text-pink-600 uppercase tracking-widest pt-2">
                            Sugestão: Altere a data ou o horário do agendamento para conseguir escalar este profissional.
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                          <button
                            onClick={() => setEditMode('remarcar')}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                          >
                            Alterar Data / Horário
                          </button>
                          <button
                            onClick={() => setEditStep('select_prof')}
                            className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors"
                          >
                            Escolher outro Profissional
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Passo 3: Confirmar Troca */}
                    {editStep === 'confirm' && (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 p-6 rounded-[2rem] text-white text-center shadow-lg">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                            <Users size={24} />
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight">Confirmar Troca</h3>
                          <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Novo profissional para o serviço</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Serviço</p>
                            <p className="text-sm font-bold text-slate-800">
                              {(appointment.services && appointment.services[selectedServiceIdx || 0]?.nome) || appointment.service_nome}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 relative">
                            {/* Profissional Antigo */}
                            <div className="flex-1 bg-red-50/50 border border-red-100 p-4 rounded-3xl opacity-60">
                              <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">Atual</p>
                              <p className="text-xs font-black text-slate-800 truncate">
                                {(appointment.services && appointment.services[selectedServiceIdx || 0]?.professional_nome) || appointment.professional_nome}
                              </p>
                            </div>

                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-100 rounded-full flex items-center justify-center text-slate-400 z-10">
                              <ChevronRight size={16} />
                            </div>

                            {/* Novo Profissional */}
                            <div className="flex-1 bg-emerald-50 border border-emerald-100 p-4 rounded-3xl shadow-sm ring-4 ring-emerald-50/50">
                              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Novo</p>
                              <p className="text-xs font-black text-slate-900 truncate">{selectedNewProf?.nome}</p>
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={isSavingUpdate}
                          onClick={async () => {
                            setIsSavingUpdate(true);
                            try {
                              let updates = {};
                              
                              if (appointment.services) {
                                const newServices = [...appointment.services];
                                newServices[selectedServiceIdx || 0] = {
                                  ...newServices[selectedServiceIdx || 0],
                                  professional_id: selectedNewProf.id,
                                  professional_nome: selectedNewProf.nome
                                };
                                updates.services = newServices;
                                updates.itinerary = newServices;
                                
                                // Se estivermos trocando o profissional do primeiro serviço (ou se for o único), 
                                // atualizamos também o root para que a agenda e o calendário mostrem a mudança.
                                if (selectedServiceIdx === 0 || newServices.length === 1) {
                                  updates.professional_id = selectedNewProf.id;
                                  updates.professional_nome = selectedNewProf.nome;
                                }
                              } else {
                                updates.professional_id = selectedNewProf.id;
                                updates.professional_nome = selectedNewProf.nome;
                              }
                              
                              console.log("Enviando atualizações para o banco:", updates);
                              await onUpdateAppointment(appointment.id, updates);
                              handleClose();
                            } catch (error) {
                              console.error("Erro ao salvar troca de profissional:", error);
                            } finally {
                              setIsSavingUpdate(false);
                            }
                          }}
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isSavingUpdate ? 'Salvando...' : 'Confirmar Troca'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : editMode === 'remover' ? (
                  <motion.div
                    key="edit-remover"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {editStep === 'select_service' ? (
                      <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                          <p className="text-xs font-bold text-red-600 leading-relaxed">
                            Selecione o serviço que deseja remover deste agendamento. Se for o único serviço, o agendamento completo será mantido apenas com os outros itens.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {(appointment.services || []).map((s, idx) => (
                            <button
                              key={idx}
                              disabled={(appointment.services || []).length <= 1}
                              onClick={() => {
                                setSelectedServiceIdx(idx);
                                setEditStep('confirm');
                              }}
                              className={`w-full flex justify-between items-center p-4 rounded-2xl border transition-all ${
                                (appointment.services || []).length <= 1
                                  ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                  : 'bg-white border-slate-100 hover:border-red-200 hover:bg-red-50 group'
                              }`}
                            >
                              <div className="text-left">
                                <p className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors">{s.nome}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">R$ {s.preco || s.price}</p>
                              </div>
                              <Trash2 size={18} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                            </button>
                          ))}
                        </div>

                        {(appointment.services || []).length <= 1 && (
                          <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Não é possível remover o único serviço. Para cancelar tudo, use o botão "Cancelar" no rodapé.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-gradient-to-r from-red-600 to-rose-500 p-6 rounded-[2rem] text-white text-center shadow-lg">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                            <Scissors size={24} />
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight">Confirmar Remoção</h3>
                          <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">O agendamento será atualizado</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-4">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço Removido</span>
                            <span className="text-xs font-black text-red-600">-{appointment.services[selectedServiceIdx]?.nome}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Valor Total</span>
                            <span className="text-lg font-black text-slate-900">
                              R$ {appointment.total_price - (appointment.services[selectedServiceIdx]?.preco || appointment.services[selectedServiceIdx]?.price || 0)}
                            </span>
                          </div>
                        </div>

                        <button
                          disabled={isSavingUpdate}
                          onClick={async () => {
                            setIsSavingUpdate(true);
                            try {
                              const newServices = appointment.services.filter((_, i) => i !== selectedServiceIdx);
                              const removedService = appointment.services[selectedServiceIdx];
                              
                              const updates = {
                                services: newServices,
                                itinerary: newServices,
                                total_price: appointment.total_price - (removedService.preco || removedService.price || 0),
                                total_duration: appointment.total_duration - (removedService.duracao || removedService.duration || 0)
                              };
                              
                              await onUpdateAppointment(appointment.id, updates);
                              handleClose();
                            } catch (error) {
                              console.error(error);
                            } finally {
                              setIsSavingUpdate(false);
                            }
                          }}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isSavingUpdate ? 'Removendo...' : 'Confirmar Remoção'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ) : !confirmAction ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-5 sm:space-y-6"
                  >
                    {/* Info Grid - Data e Horário compactos */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-pink-600 mb-0.5 sm:mb-1">
                          <Calendar size={14} className="sm:size-16" />
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Data</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-slate-800">{format(appDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                      </div>
                      <div className="bg-slate-50/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-pink-600 mb-0.5 sm:mb-1">
                          <Clock size={14} className="sm:size-16" />
                          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Horário</span>
                        </div>
                        <p className="text-sm sm:text-base font-bold text-slate-800">{format(appDate, "HH:mm")}</p>
                      </div>
                    </div>

                    {/* Linha do Tempo Otimizada */}
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Linha do Tempo</h4>
                      <div className="bg-pink-50/20 border border-pink-50 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-5 sm:space-y-6">
                        {appointment.services ? (() => {
                          let runningTime = appointment.data_hora?.toDate ? appointment.data_hora.toDate() : (appointment.data_hora ? new Date(appointment.data_hora) : new Date());
                          
                          return appointment.services.map((service, idx) => {
                            let sTime = service.start_time?.toDate ? service.start_time.toDate() : (service.start_time ? new Date(service.start_time) : null);
                            let eTime = service.end_time?.toDate ? service.end_time.toDate() : (service.end_time ? new Date(service.end_time) : null);
                            
                            if (!sTime) sTime = runningTime;
                            if (!eTime) eTime = addMinutes(sTime, Number(service.duracao || service.duration || appointment.duration || 30));
                            runningTime = eTime;

                            const isValidStart = sTime instanceof Date && !isNaN(sTime.getTime());
                            const isValidEnd = eTime instanceof Date && !isNaN(eTime.getTime());

                            return (
                              <div key={idx} className="space-y-1 sm:space-y-1.5 relative">
                                {/* Linha 1: Horário e Duração */}
                                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-black text-pink-600 uppercase tracking-widest">
                                  <span>{isValidStart ? format(sTime, 'HH:mm') : '--:--'} - {isValidEnd ? format(eTime, 'HH:mm') : '--:--'}</span>
                                  <span className="w-1 h-1 bg-pink-200 rounded-full"></span>
                                  <span className="text-slate-400">{service.duracao || service.duration || appointment.duration} min</span>
                                </div>
                                
                                {/* Linha 2: Nome do Serviço */}
                                <p className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-tight leading-snug truncate">
                                  {service.nome || service.name || service.service_nome}
                                </p>
                                
                                {/* Linha 3: Profissional */}
                                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">
                                  <span className="opacity-60">profissional</span>
                                  <span className="text-slate-900 font-black">
                                    {service.professional_nome || appointment.professional_nome || 'Profissional'}
                                  </span>
                                </div>
                                
                                {idx !== (appointment.services.length - 1) && (
                                  <div className="absolute -bottom-3 sm:-bottom-4 left-0 w-full h-[1px] bg-pink-100/40" />
                                )}
                              </div>
                            );
                          });
                        })() : (
                          <div className="flex justify-between items-center py-1">
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-pink-400" />
                              <span className="text-sm font-bold text-slate-800">{appointment.service_nome}</span>
                            </div>
                            <span className="text-xs font-medium text-slate-500">{appointment.duration} min</span>
                          </div>
                        )}
                        
                        {/* Total consolidado */}
                        <div className="pt-3.5 sm:pt-4 border-t border-pink-100/60 flex justify-between items-center">
                          <span className="font-black text-slate-900 text-[11px] sm:text-sm uppercase tracking-widest">Valor Total</span>
                          <span className="text-lg sm:text-xl font-black text-pink-600">R$ {appointment.total_price || appointment.preco}</span>
                        </div>
                      </div>
                    </div>

                    {/* Observações compactas */}
                    {appointment.observacoes && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Obs.</h4>
                        <div className="bg-blue-50/20 border border-blue-50/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex gap-2.5 sm:gap-3">
                          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">{appointment.observacoes}</p>
                        </div>
                      </div>
                    )}

                    {/* Ações de Rodapé Mobile - Editar e Recibo */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                      <button
                        onClick={() => setEditMode('menu')}
                        className="flex items-center justify-center gap-2 py-3.5 sm:py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-slate-50 transition-all active:scale-95"
                      >
                        <Pencil size={16} className="sm:size-18" />
                        <span>Editar</span>
                      </button>
                      
                      <button
                        onClick={() => setViewMode('receipt')}
                        className="flex items-center justify-center gap-2 py-3.5 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-slate-800 shadow-lg transition-all active:scale-95"
                      >
                        <Receipt size={16} className="sm:size-18" />
                        <span>Recibo</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center py-8 sm:py-10 text-center space-y-5 sm:space-y-6"
                  >
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center ${confirmAction === 'cancel' ? 'bg-red-50 text-red-500' : 'bg-pink-50 text-pink-600'}`}>
                      {confirmAction === 'cancel' ? <Trash2 size={40} className="sm:size-48" /> : <CheckCircle size={40} className="sm:size-48" />}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                        {confirmAction === 'cancel' ? 'Tem certeza?' : 'Finalizar atendimento?'}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 font-medium px-4">
                        {confirmAction === 'cancel' 
                          ? `Deseja realmente CANCELAR o agendamento de ${appointment.user_nome}?`
                          : `Confirmar a conclusão do serviço para ${appointment.user_nome}?`}
                      </p>
                    </div>

                    {confirmAction === 'complete' && (
                      <div className="w-full px-6 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left ml-1">Forma de Pagamento</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'pix', label: 'PIX', icon: '✨' },
                            { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                            { id: 'credito', label: 'Cartão Crédito', icon: '💳' },
                            { id: 'debito', label: 'Cartão Débito', icon: '💳' }
                          ].map((method) => (
                            <button
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id)}
                              className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                                paymentMethod === method.id 
                                  ? 'border-pink-600 bg-pink-50 text-pink-700' 
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-pink-200'
                              }`}
                            >
                              <span className="text-sm">{method.icon}</span>
                              <span className="text-[10px] font-black uppercase tracking-tight">{method.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-xs px-4">
                      <button
                        onClick={() => {
                          if (confirmAction === 'cancel') {
                            onCancel(appointment.id);
                          } else {
                            onComplete(appointment.id, paymentMethod);
                          }
                          handleClose();
                        }}
                        className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs text-white shadow-lg transition-all active:scale-95 ${confirmAction === 'cancel' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-pink-600 hover:bg-pink-700 shadow-pink-100'}`}
                      >
                        {confirmAction === 'cancel' ? 'Sim, Cancelar Agora' : 'Sim, Finalizar Agora'}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="w-full py-3 sm:py-4 bg-gray-100 text-gray-500 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-gray-200 transition-all"
                      >
                        Voltar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Actions - Fixo na base para mobile */}
            {!confirmAction && !editMode && viewMode === 'details' && (appointment.status === 'ativo' || appointment.status === 'scheduled' || appointment.status === 'confirmado') && (
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => setConfirmAction('cancel')}
                  className="flex items-center justify-center gap-2 py-3 sm:py-3.5 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  <Trash2 size={16} />
                  <span>Cancelar</span>
                </button>
                <button
                  onClick={() => setConfirmAction('complete')}
                  className="flex items-center justify-center gap-2 py-3 sm:py-3.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-md shadow-emerald-100 transition-all active:scale-95"
                >
                  <CheckCircle size={16} />
                  <span>Finalizar</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AppointmentDetailsModal;
