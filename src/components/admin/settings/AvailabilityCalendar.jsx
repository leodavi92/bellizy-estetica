import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  addMinutes,
  eachDayOfInterval,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Trash2, AlertCircle, Sparkles, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../services/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function AvailabilityCalendar({ establishment, appointments }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const blockedSlots = establishment?.blocked_slots || [];
  const availabilityRules = establishment?.availability_rules || {};

  const dailyAppointments = appointments?.filter(app => {
    const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
    return isSameDay(appDate, selectedDate);
  }) || [];

  // Render Header
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
          <CalendarIcon size={20} />
        </div>
        <h2 className="text-xl font-black text-gray-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 active:scale-90"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 active:scale-90"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );

  // Render Days of Week
  const renderDays = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map(day => (
          <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>
    );
  };

  // Render Cells
  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isDayToday = isToday(day);
        const dayStr = format(day, 'yyyy-MM-dd');
        
        // Check if day is blocked (full day)
        const isFullDayBlocked = blockedSlots.some(b => b.date === dayStr && b.start_time === '00:00' && b.end_time === '23:59');
        // Check if has some blocks
        const hasBlocks = blockedSlots.some(b => b.date === dayStr);
        // Check if day is enabled in rules
        const dayName = format(day, 'eeee', { locale: enUS }).toLowerCase();
        const isEnabled = availabilityRules[dayName]?.enabled;

        days.push(
          <div
            key={day}
            onClick={() => {
              if (isSelected) {
                setShowBlockModal(true);
              } else {
                setSelectedDate(cloneDay);
              }
            }}
            className={`relative h-14 sm:h-20 flex flex-col items-center justify-center cursor-pointer transition-all border-2 rounded-2xl m-0.5 sm:m-1 ${
              !isCurrentMonth ? 'opacity-20 pointer-events-none' : ''
            } ${
              isSelected 
                ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200 z-10' 
                : isFullDayBlocked
                  ? 'bg-red-50 border-red-100 text-red-400'
                  : !isEnabled
                    ? 'bg-gray-50 border-transparent text-gray-300'
                    : 'bg-white border-transparent hover:border-pink-100 text-gray-700'
            }`}
          >
            <span className={`text-sm sm:text-lg font-black ${isDayToday && !isSelected ? 'text-pink-600' : ''}`}>
              {format(day, 'd')}
            </span>
            
            <div className="flex gap-0.5 mt-1">
              {hasBlocks && !isFullDayBlocked && <div className="w-1 h-1 rounded-full bg-orange-400" />}
              {isFullDayBlocked && <div className="w-1 h-1 rounded-full bg-red-400" />}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Grid */}
        <div className="lg:col-span-7">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
          
          <div className="mt-6 flex flex-wrap gap-4 px-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase">Hoje</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-[10px] font-black text-gray-400 uppercase">Bloqueado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <span className="text-[10px] font-black text-gray-400 uppercase">Fechado</span>
            </div>
          </div>
        </div>

        {/* Day Detail & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          <DayScheduleView 
            date={selectedDate} 
            establishment={establishment} 
            appointments={dailyAppointments}
            onAddBlock={() => setShowBlockModal(true)}
          />
        </div>
      </div>

      <AnimatePresence>
        {showBlockModal && (
          <QuickBlockModal 
            date={selectedDate} 
            establishment={establishment} 
            appointments={dailyAppointments}
            onClose={() => setShowBlockModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DayScheduleView({ date, establishment, appointments, onAddBlock }) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
  const rule = establishment?.availability_rules?.[dayName] || { enabled: false };
  const blocks = (establishment?.blocked_slots || []).filter(b => b.date === dateStr);
  const [loading, setLoading] = useState(false);

  const handleRemoveBlock = async (block) => {
    if (!confirm("Remover este bloqueio?")) return;
    setLoading(true);
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      await updateDoc(estRef, {
        blocked_slots: arrayRemove(block)
      });
    } catch (error) {
      alert("Erro ao remover bloqueio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      key={dateStr}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-50/50 rounded-[2.5rem] p-6 sm:p-8 border-2 border-white space-y-6 h-full"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-gray-800 tracking-tight">
            {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </h3>
          <p className="text-sm font-bold text-gray-400 capitalize">
            {format(date, "eeee", { locale: ptBR })}
          </p>
        </div>
        <button 
          onClick={onAddBlock}
          className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Weekly Rule Status */}
        <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
          rule.enabled ? 'bg-white border-green-50' : 'bg-gray-100 border-transparent opacity-60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              rule.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
            }`}>
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Escala Padrão</p>
              <p className="font-bold text-gray-700">
                {rule.enabled ? `${rule.start} às ${rule.end}` : 'Fechado'}
              </p>
            </div>
          </div>
        </div>

        {/* Manual Blocks */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">Bloqueios Manuais</h4>
          {blocks.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-[2rem]">
              <p className="text-xs font-bold text-gray-300">Nenhum bloqueio para este dia.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-orange-50 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center">
                      <Trash2 size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-700">
                        {block.start_time === '00:00' && block.end_time === '23:59' 
                          ? 'Dia Inteiro' 
                          : `${block.start_time} - ${block.end_time}`}
                      </p>
                      <p className="text-[10px] font-medium text-gray-400">{block.reason}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveBlock(block)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function QuickBlockModal({ date, establishment, appointments, onClose }) {
  const [loading, setLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [reason, setReason] = useState('Indisponível');
  const [isFullDay, setIsFullDay] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  // Gerar slots do dia baseado na regra semanal
  const slots = React.useMemo(() => {
    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
    const rule = establishment?.availability_rules?.[dayName] || { enabled: false, start: '08:00', end: '18:00' };
    
    if (!rule.enabled && !isFullDay) return [];

    const [startH, startM] = rule.start.split(':').map(Number);
    const [endH, endM] = rule.end.split(':').map(Number);
    
    const slotsList = [];
    let current = new Date(date);
    current.setHours(startH, startM, 0, 0);
    
    const limit = new Date(date);
    limit.setHours(endH, endM, 0, 0);

    while (current < limit) {
      slotsList.push(new Date(current));
      current = addMinutes(current, 30);
    }
    
    return slotsList;
  }, [date, establishment, isFullDay]);

  const toggleSlot = (slot) => {
    const slotStr = format(slot, 'HH:mm');
    if (selectedSlots.includes(slotStr)) {
      setSelectedSlots(selectedSlots.filter(s => s !== slotStr));
    } else {
      setSelectedSlots([...selectedSlots, slotStr].sort());
    }
  };

  const hasConflict = React.useMemo(() => {
    if (isFullDay) return appointments.length > 0;
    
    return appointments.some(app => {
      const appStart = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
      const appEnd = addMinutes(appStart, app.duration || 30);
      
      return selectedSlots.some(slotStr => {
        const [h, m] = slotStr.split(':').map(Number);
        const slotStart = new Date(date);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = addMinutes(slotStart, 30);
        
        return slotStart < appEnd && slotEnd > appStart;
      });
    });
  }, [selectedSlots, isFullDay, appointments, date]);

  const handleAddBlock = async () => {
    if (hasConflict && !showConflictWarning) {
      setShowConflictWarning(true);
      return;
    }

    setLoading(true);
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      let newBlocks = [];

      if (isFullDay) {
        newBlocks.push({
          id: Math.random().toString(36).substr(2, 9),
          date: dateStr,
          start_time: '00:00',
          end_time: '23:59',
          reason: reason,
          createdAt: new Date().toISOString()
        });
      } else {
        // Agrupar slots consecutivos para criar blocos menores
        const sortedSlots = [...selectedSlots].sort();
        if (sortedSlots.length === 0) {
          alert("Selecione ao menos um horário.");
          setLoading(false);
          return;
        }

        // Para simplificar, vamos criar um bloco para cada slot de 30min
        // Ou podemos tentar agrupar. Vamos agrupar para ficar mais limpo.
        let currentBlock = null;

        sortedSlots.forEach((slotStr, index) => {
          const [h, m] = slotStr.split(':').map(Number);
          if (!currentBlock) {
            currentBlock = { start: slotStr, end: format(addMinutes(new Date(2000, 0, 1, h, m), 30), 'HH:mm') };
          } else {
            const lastEnd = currentBlock.end;
            if (lastEnd === slotStr) {
              currentBlock.end = format(addMinutes(new Date(2000, 0, 1, h, m), 30), 'HH:mm');
            } else {
              newBlocks.push({
                id: Math.random().toString(36).substr(2, 9),
                date: dateStr,
                start_time: currentBlock.start,
                end_time: currentBlock.end,
                reason: reason,
                createdAt: new Date().toISOString()
              });
              currentBlock = { start: slotStr, end: format(addMinutes(new Date(2000, 0, 1, h, m), 30), 'HH:mm') };
            }
          }

          if (index === sortedSlots.length - 1) {
            newBlocks.push({
              id: Math.random().toString(36).substr(2, 9),
              date: dateStr,
              start_time: currentBlock.start,
              end_time: currentBlock.end,
              reason: reason,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      // Adicionar todos os novos blocos
      const currentBlockedSlots = establishment.blocked_slots || [];
      await updateDoc(estRef, {
        blocked_slots: [...currentBlockedSlots, ...newBlocks]
      });
      
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar bloqueio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-800">Bloquear Horário</h3>
            <p className="text-sm font-bold text-gray-400">
              {format(date, "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Opção Dia Inteiro */}
          <button 
            onClick={() => setIsFullDay(!isFullDay)}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
              isFullDay ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFullDay ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                <CalendarIcon size={20} />
              </div>
              <span className={`font-bold ${isFullDay ? 'text-red-600' : 'text-gray-700'}`}>Bloquear dia inteiro?</span>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${isFullDay ? 'bg-red-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isFullDay ? 'left-5' : 'left-1'}`} />
            </div>
          </button>

          {!isFullDay && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-pink-600">Selecione os Horários</label>
                <span className="text-[10px] font-bold text-gray-400">{selectedSlots.length} selecionados</span>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => {
                  const slotStr = format(slot, 'HH:mm');
                  const isSelected = selectedSlots.includes(slotStr);
                  const isOccupied = appointments.some(app => {
                    const appStart = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
                    const appEnd = addMinutes(appStart, app.duration || 30);
                    const slotEnd = addMinutes(slot, 30);
                    return slot < appEnd && slotEnd > appStart;
                  });

                  return (
                    <button
                      key={slotStr}
                      onClick={() => toggleSlot(slot)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all border-2 ${
                        isSelected 
                          ? 'bg-slate-900 border-slate-900 text-white' 
                          : isOccupied
                            ? 'bg-amber-50 border-amber-100 text-amber-600'
                            : 'bg-gray-50 border-transparent text-gray-600 hover:border-pink-200'
                      }`}
                    >
                      {slotStr}
                      {isOccupied && <div className="w-1 h-1 bg-amber-400 rounded-full mx-auto mt-1" />}
                    </button>
                  );
                })}
              </div>
              
              {slots.length === 0 && (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-sm font-bold text-gray-400">Não há horários de trabalho configurados para este dia.</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Motivo do Bloqueio</label>
            <input 
              type="text" 
              placeholder="Ex: Almoço, Compromisso..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-pink-300 transition-all"
            />
          </div>

          {showConflictWarning && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-2"
            >
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle size={20} />
                <p className="text-sm font-black uppercase tracking-tight">Aviso de Conflito</p>
              </div>
              <p className="text-xs font-bold text-amber-600 leading-relaxed">
                Existem agendamentos de clientes nos horários selecionados. Bloquear estes horários irá sobrepor os agendamentos existentes. Deseja continuar mesmo assim?
              </p>
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 p-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleAddBlock}
              disabled={loading || (!isFullDay && selectedSlots.length === 0)}
              className={`flex-[2] p-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 ${
                showConflictWarning ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {loading ? 'Salvando...' : showConflictWarning ? 'Sim, Bloquear mesmo assim' : 'Confirmar Bloqueio'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
