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
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AppointmentDetailsModal = ({ isOpen, onClose, appointment, onCancel, onComplete }) => {
  const [confirmAction, setConfirmAction] = useState(null); // 'cancel' or 'complete'

  if (!appointment) return null;

  const appDate = appointment.data_hora?.toDate ? appointment.data_hora.toDate() : new Date(appointment.data_hora);
  
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

  const handleClose = () => {
    setConfirmAction(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="relative h-32 bg-gradient-to-r from-pink-600 to-rose-500 p-6 flex items-end">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-[1.5rem] bg-white p-1 shadow-xl">
                  <div className="w-full h-full rounded-[1.2rem] bg-pink-50 flex items-center justify-center text-pink-600 overflow-hidden">
                    {userAvatar ? (
                      <img src={userAvatar} alt={appointment.user_nome} className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                </div>
                <div className="text-white">
                  <h3 className="text-2xl font-black tracking-tight">{appointment.user_nome}</h3>
                  <p className="text-white/80 font-medium flex items-center gap-1">
                    {userPhone ? userPhone : 'Telefone não cadastrado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 relative">
              <AnimatePresence mode="wait">
                {!confirmAction ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 text-pink-600 mb-1">
                          <Calendar size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</span>
                        </div>
                        <p className="font-bold text-gray-800">{format(appDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 text-pink-600 mb-1">
                          <Clock size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Horário</span>
                        </div>
                        <p className="font-bold text-gray-800">{format(appDate, "HH:mm")}</p>
                      </div>
                    </div>

                    {/* Services Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Serviços Selecionados</h4>
                      <div className="bg-pink-50/30 border border-pink-50 rounded-3xl p-4 space-y-3">
                        {appointment.services ? appointment.services.map((service, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-pink-400" />
                              <span className="font-bold text-gray-800">{service.nome || service.name}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-500">{service.duracao || service.duration} min</span>
                          </div>
                        )) : (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-pink-400" />
                              <span className="font-bold text-gray-800">{appointment.service_nome}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-500">{appointment.duration} min</span>
                          </div>
                        )}
                        <div className="pt-3 border-t border-pink-100 flex justify-between items-center">
                          <span className="font-black text-gray-900">Total</span>
                          <div className="text-right">
                            <p className="text-lg font-black text-pink-600">R$ {appointment.total_price || appointment.preco}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{appointment.total_duration || appointment.duration} min de duração</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Observations */}
                    {appointment.observacoes && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Observações</h4>
                        <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex gap-3">
                          <Info size={18} className="text-blue-400 shrink-0" />
                          <p className="text-sm text-gray-600 leading-relaxed">{appointment.observacoes}</p>
                        </div>
                      </div>
                    )}

                    {/* WhatsApp Action */}
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          if (!formattedPhone) return;
                          window.open(`https://wa.me/${formattedPhone}`, '_blank');
                        }}
                        disabled={!formattedPhone}
                        className={`flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${formattedPhone ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-100' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
                      >
                        <Phone size={20} />
                        <span>Conversar no WhatsApp</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!formattedPhone) return;
                          const message = encodeURIComponent(`Olá ${appointment.user_nome}! ✨ Passando para confirmar seu agendamento de ${appointment.services ? appointment.services.map(s => s.nome).join(' + ') : appointment.service_nome} para ${format(appDate, "dd/MM 'às' HH:mm")}. Podemos confirmar?`);
                          window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
                        }}
                        disabled={!formattedPhone}
                        className={`flex items-center justify-center gap-3 w-full border-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 ${formattedPhone ? 'bg-white border-green-500 text-green-600 hover:bg-green-50' : 'bg-white border-gray-200 text-gray-400 cursor-not-allowed'}`}
                      >
                        <MessageSquare size={18} />
                        <span>Enviar Lembrete</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center py-10 text-center space-y-6"
                  >
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${confirmAction === 'cancel' ? 'bg-red-50 text-red-500' : 'bg-pink-50 text-pink-600'}`}>
                      {confirmAction === 'cancel' ? <Trash2 size={48} /> : <CheckCircle size={48} />}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                        {confirmAction === 'cancel' ? 'Tem certeza?' : 'Que bom que finalizou!'}
                      </h3>
                      <p className="text-gray-500 font-medium px-4">
                        {confirmAction === 'cancel' 
                          ? `Deseja realmente CANCELAR o agendamento de ${appointment.user_nome}?`
                          : `Tudo certo com o atendimento de ${appointment.user_nome}? Clique abaixo para confirmar.`}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <button
                        onClick={() => {
                          if (confirmAction === 'cancel') {
                            onCancel(appointment.id);
                          } else {
                            onComplete(appointment.id);
                          }
                          handleClose();
                        }}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-lg transition-all active:scale-95 ${confirmAction === 'cancel' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-pink-600 hover:bg-pink-700 shadow-pink-100'}`}
                      >
                        {confirmAction === 'cancel' ? 'Sim, Cancelar Agora' : 'Sim, Confirmar Conclusão'}
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all"
                      >
                        Voltar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Actions */}
            {!confirmAction && (appointment.status === 'ativo' || appointment.status === 'scheduled' || appointment.status === 'confirmado') && (
              <div className="p-6 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmAction('cancel')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-2xl font-bold transition-all"
                >
                  <Trash2 size={18} />
                  <span>Cancelar</span>
                </button>
                <button
                  onClick={() => setConfirmAction('complete')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-pink-600 text-white hover:bg-pink-700 rounded-2xl font-bold shadow-md shadow-pink-100 transition-all"
                >
                  <CheckCircle size={18} />
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
