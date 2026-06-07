import React, { useState } from 'react';
import { Clock, Calendar, Save, CheckCircle2, Coffee, ArrowRight } from 'lucide-react';
import { db } from '../../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Segunda' },
  { id: 'tuesday', label: 'Terça' },
  { id: 'wednesday', label: 'Quarta' },
  { id: 'thursday', label: 'Quinta' },
  { id: 'friday', label: 'Sexta' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' }
];

const DEFAULT_AVAILABILITY = {
  enabled: true,
  start: '08:00',
  end: '18:00',
  break_enabled: false,
  break_start: '12:00',
  break_end: '13:00'
};

export default function WeeklyAvailabilityEditor({ establishment, onSave }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [availability, setAvailability] = useState(() => {
    const base = establishment?.availability_rules || {};
    const initial = {};
    
    DAYS_OF_WEEK.forEach(day => {
      initial[day.id] = {
        ...DEFAULT_AVAILABILITY,
        ...(base[day.id] || {}),
        // Garante que campos desativados por padrão em dias específicos (sab/dom) sejam mantidos se não houver base
        enabled: base[day.id]?.enabled ?? (day.id !== 'saturday' && day.id !== 'sunday')
      };
    });
    
    return initial;
  });

  const handleToggleDay = (dayId) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], enabled: !prev[dayId].enabled }
    }));
  };

  const handleChangeTime = (dayId, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      await updateDoc(estRef, {
        availability_rules: availability
      });
      setSuccess(true);
      if (onSave) onSave();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar disponibilidade:", error);
      alert("Erro ao salvar horários.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center shrink-0">
          <Calendar size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">Horário Semanal</h3>
          <p className="text-sm text-gray-500">Defina sua rotina de atendimento padrão.</p>
        </div>
      </div>

      <div className="space-y-3">
        {DAYS_OF_WEEK.map((day) => (
          <div 
            key={day.id}
            className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-[2rem] border-2 transition-all ${
              availability[day.id].enabled 
              ? 'bg-white border-pink-100' 
              : 'bg-gray-50/50 border-transparent opacity-60'
            }`}
          >
            <div className="flex items-center justify-between sm:w-40">
              <span className={`font-bold ${availability[day.id].enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                {day.label}
              </span>
              <button
                onClick={() => handleToggleDay(day.id)}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  availability[day.id].enabled ? 'bg-pink-500' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  availability[day.id].enabled ? 'left-5' : 'left-1'
                }`} />
              </button>
            </div>

            {availability[day.id].enabled && (
              <div className="flex-1 space-y-4">
                {/* Horário de Funcionamento */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400">
                      <Clock size={14} />
                    </div>
                    <input
                      type="time"
                      value={availability[day.id].start}
                      onChange={(e) => handleChangeTime(day.id, 'start', e.target.value)}
                      className="w-full pl-9 p-3 bg-pink-50/50 border-2 border-transparent rounded-xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    />
                  </div>
                  <span className="text-gray-400 font-bold">até</span>
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400">
                      <Clock size={14} />
                    </div>
                    <input
                      type="time"
                      value={availability[day.id].end}
                      onChange={(e) => handleChangeTime(day.id, 'end', e.target.value)}
                      className="w-full pl-9 p-3 bg-pink-50/50 border-2 border-transparent rounded-xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    />
                  </div>
                </div>

                {/* Horário de Almoço/Intervalo */}
                <div className="pt-3 border-t border-dashed border-pink-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Coffee size={12} />
                      <span>Intervalo / Almoço</span>
                    </div>
                    <button
                      onClick={() => handleChangeTime(day.id, 'break_enabled', !availability[day.id].break_enabled)}
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${
                        availability[day.id].break_enabled 
                        ? 'bg-amber-100 text-amber-600' 
                        : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {availability[day.id].break_enabled ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>

                  {availability[day.id].break_enabled && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="relative flex-1">
                        <input
                          type="time"
                          value={availability[day.id].break_start || '12:00'}
                          onChange={(e) => handleChangeTime(day.id, 'break_start', e.target.value)}
                          className="w-full p-2.5 bg-amber-50/50 border-2 border-transparent rounded-xl outline-none focus:border-amber-300 transition-all font-bold text-gray-700 text-xs"
                        />
                      </div>
                      <ArrowRight size={14} className="text-amber-300" />
                      <div className="relative flex-1">
                        <input
                          type="time"
                          value={availability[day.id].break_end || '13:00'}
                          onChange={(e) => handleChangeTime(day.id, 'break_end', e.target.value)}
                          className="w-full p-2.5 bg-amber-50/50 border-2 border-transparent rounded-xl outline-none focus:border-amber-300 transition-all font-bold text-gray-700 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {!availability[day.id].enabled && (
              <div className="flex-1 flex items-center justify-center sm:justify-start">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fechado</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 p-4 bg-slate-950 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
        ) : success ? (
          <CheckCircle2 size={20} />
        ) : (
          <Save size={20} />
        )}
        {success ? 'Horários Salvos!' : 'Salvar Agenda Semanal'}
      </button>
    </div>
  );
}
