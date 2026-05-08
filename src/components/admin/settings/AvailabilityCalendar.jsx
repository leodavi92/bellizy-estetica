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
  eachDayOfInterval,
  isToday,
  parseISO
} from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../services/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function AvailabilityCalendar({ establishment }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const blockedSlots = establishment?.blocked_slots || [];
  const availabilityRules = establishment?.availability_rules || {};

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
            onClick={() => setSelectedDate(cloneDay)}
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
            onAddBlock={() => setShowBlockModal(true)}
          />
        </div>
      </div>

      <AnimatePresence>
        {showBlockModal && (
          <QuickBlockModal 
            date={selectedDate} 
            establishment={establishment} 
            onClose={() => setShowBlockModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DayScheduleView({ date, establishment, onAddBlock }) {
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

function QuickBlockModal({ date, establishment, onClose }) {
  const [loading, setLoading] = useState(false);
  const [block, setBlock] = useState({
    start_time: '08:00',
    end_time: '18:00',
    reason: 'Indisponível',
    isFullDay: false
  });

  const handleAddBlock = async () => {
    setLoading(true);
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      const newBlock = {
        id: Math.random().toString(36).substr(2, 9),
        date: format(date, 'yyyy-MM-dd'),
        start_time: block.isFullDay ? '00:00' : block.start_time,
        end_time: block.isFullDay ? '23:59' : block.end_time,
        reason: block.reason,
        createdAt: new Date().toISOString()
      };

      await updateDoc(estRef, {
        blocked_slots: arrayUnion(newBlock)
      });
      onClose();
    } catch (error) {
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
        className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="text-center space-y-2 mb-8">
          <h3 className="text-2xl font-black text-gray-800">Bloquear Horário</h3>
          <p className="text-sm font-bold text-gray-400">
            {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="space-y-6">
          <button 
            onClick={() => setBlock({ ...block, isFullDay: !block.isFullDay })}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
              block.isFullDay ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <span className={`font-bold ${block.isFullDay ? 'text-red-600' : 'text-gray-700'}`}>Bloquear dia inteiro?</span>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${block.isFullDay ? 'bg-red-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${block.isFullDay ? 'left-5' : 'left-1'}`} />
            </div>
          </button>

          {!block.isFullDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Início</label>
                <input 
                  type="time" 
                  value={block.start_time}
                  onChange={(e) => setBlock({ ...block, start_time: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-pink-300 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Fim</label>
                <input 
                  type="time" 
                  value={block.end_time}
                  onChange={(e) => setBlock({ ...block, end_time: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-pink-300 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Motivo</label>
            <input 
              type="text" 
              placeholder="Ex: Almoço, Viagem..."
              value={block.reason}
              onChange={(e) => setBlock({ ...block, reason: e.target.value })}
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-pink-300 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 p-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleAddBlock}
              disabled={loading}
              className="flex-2 p-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Bloquear'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
