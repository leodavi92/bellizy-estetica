import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, Save } from 'lucide-react';
import WeeklyAvailabilityEditor from '../../settings/WeeklyAvailabilityEditor';
import AvailabilityCalendar from '../../settings/AvailabilityCalendar';

const HorariosSection = ({
  showWeeklyEditor,
  showIntervalEditor,
  setShowWeeklyEditor,
  setShowIntervalEditor,
  establishment,
  tempInterval,
  setTempInterval,
  handleSaveInterval,
  isSavingInterval,
}) => {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Gerenciar Horários</h2>
          <p className="text-gray-500 font-medium">Controle sua agenda semanal e bloqueios pontuais.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setShowWeeklyEditor(!showWeeklyEditor);
              setShowIntervalEditor(false);
            }}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
              showWeeklyEditor
                ? 'bg-slate-900 text-white shadow-slate-200'
                : 'bg-white border-2 border-pink-100 text-pink-600 hover:bg-pink-50 shadow-pink-100'
            }`}
          >
            <Calendar size={20} />
            <span>{showWeeklyEditor ? 'Voltar para Calendário' : 'Escala Semanal'}</span>
          </button>

          {!showWeeklyEditor && (
            <button
              onClick={() => {
                setShowIntervalEditor(!showIntervalEditor);
                setShowWeeklyEditor(false);
              }}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
                showIntervalEditor
                  ? 'bg-slate-900 text-white shadow-slate-200'
                  : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-indigo-100'
              }`}
            >
              <Clock size={20} />
              <span>{showIntervalEditor ? 'Voltar para Calendário' : 'Grade de Horários'}</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showWeeklyEditor ? (
          <motion.div
            key="weekly"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-pink-100 shadow-sm"
          >
            <WeeklyAvailabilityEditor
              establishment={establishment}
              onSave={() => setShowWeeklyEditor(false)}
            />
          </motion.div>
        ) : showIntervalEditor ? (
          <motion.div
            key="interval"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-indigo-100 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Intervalo de Agendamento</h3>
                <p className="text-sm text-gray-500">
                  Defina de quanto em quanto tempo novos horários podem começar.
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[15, 30, 45, 60].map(interval => (
                  <button
                    key={interval}
                    onClick={() => setTempInterval(interval)}
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 ${
                      tempInterval === interval
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]'
                        : 'bg-gray-50 border-transparent text-gray-500 hover:bg-white hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-3xl font-black">{interval}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                      minutos
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                  <strong>Dica:</strong> Se você escolher 15 minutos, suas clientes terão opções como 08:00,
                  08:15, 08:30. Se escolher 60 minutos, as opções serão apenas em horas cheias (08:00, 09:00, etc).
                </p>
              </div>

              <button
                onClick={handleSaveInterval}
                disabled={isSavingInterval || tempInterval === establishment?.settings?.slot_interval}
                className="w-full flex items-center justify-center gap-3 p-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-100"
              >
                {isSavingInterval ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                ) : (
                  <Save size={18} />
                )}
                {isSavingInterval ? 'Salvando...' : 'Salvar Configuração de Grade'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-pink-100 shadow-sm"
          >
            <AvailabilityCalendar establishment={establishment} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HorariosSection;
