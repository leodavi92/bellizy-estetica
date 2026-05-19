import React, { useMemo, useRef, useState, useEffect } from 'react';
import { addDays, subDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import UpcomingAppointmentCard from './UpcomingAppointmentCard';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import { AnimatePresence, motion } from 'framer-motion';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const NextAppointmentSection = ({ appointments }) => {
  const [mode, setMode] = useState('next'); // 'next' | 'week'
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekAnimDir, setWeekAnimDir] = useState(0);
  const [weekToast, setWeekToast] = useState('');

  const safeToDate = (dateObj) => {
    if (!dateObj) return null;
    if (dateObj.toDate) return dateObj.toDate();
    const d = new Date(dateObj);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const upcomingAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];

    const now = new Date();
    
    // Filtra agendamentos futuros e não cancelados
    return appointments
      .filter(app => {
        const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
        const isValidStatus = app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado';
        return appDate >= now && isValidStatus;
      })
      .sort((a, b) => {
        const dateA = a.data_hora?.toDate ? a.data_hora.toDate() : new Date(a.data_hora);
        const dateB = b.data_hora?.toDate ? b.data_hora.toDate() : new Date(b.data_hora);
        return dateA - dateB;
      });
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0];
  const otherUpcoming = upcomingAppointments.slice(1, 4); // Pega mais 3 próximos

  const scrollRef = useRef(null);
  const isChangingWeek = useRef(false);

  const weekDays = useMemo(() => {
    // Carregamos 3 semanas: anterior, atual e próxima para permitir rolagem fluida
    const prevWeek = subDays(weekStart, 7);
    return Array.from({ length: 21 }, (_, idx) => addDays(prevWeek, idx));
  }, [weekStart]);

  // Centraliza na semana atual ao carregar ou mudar de semana
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const weekWidth = container.offsetWidth;
      container.scrollTo({ left: weekWidth, behavior: 'instant' });
      
      // Aumentamos o delay para garantir que o scroll estabilize 
      // e o usuário não pule várias semanas seguidas acidentalmente
      const timer = setTimeout(() => {
        isChangingWeek.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [weekStart]);

  const goToWeek = (direction) => {
    if (isChangingWeek.current) return;
    isChangingWeek.current = true;

    const currentWeekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
    const weekdayIndex = Math.max(0, Math.min(6, differenceInCalendarDays(selectedDay, currentWeekStart)));
    const nextWeekStart = addDays(weekStart, direction * 7);
    setWeekAnimDir(direction);
    setWeekStart(nextWeekStart);
    setSelectedDay(addDays(nextWeekStart, weekdayIndex));
    setWeekToast(direction > 0 ? 'Próxima semana' : 'Semana anterior');
    window.clearTimeout(goToWeek._t);
    goToWeek._t = window.setTimeout(() => setWeekToast(''), 900);
  };

  const selectedDayAppointments = useMemo(() => {
    const valid = appointments || [];
    return valid
      .filter((app) => {
        const appDate = safeToDate(app.start_time || app.data_hora);
        if (!appDate) return false;
        return isSameDay(appDate, selectedDay);
      })
      .sort((a, b) => {
        const dateA = safeToDate(a.start_time || a.data_hora);
        const dateB = safeToDate(b.start_time || b.data_hora);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeA - timeB;
      });
  }, [appointments, selectedDay]);

  const handleCancel = async (id) => {
    try {
      const ref = doc(db, "appointments", id);
      await updateDoc(ref, { status: 'cancelled' });
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      alert("Erro ao cancelar agendamento.");
    }
  };

  const handleComplete = async (id) => {
    try {
      const ref = doc(db, "appointments", id);
      await updateDoc(ref, { status: 'completed' });
    } catch (error) {
      console.error("Erro ao finalizar agendamento:", error);
      alert("Erro ao finalizar agendamento.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Clock size={20} className="text-pink-600" />
            Agenda
          </h3>
          <div className="flex bg-white p-1 rounded-2xl border border-pink-100 shadow-sm">
            <button
              type="button"
              onClick={() => setMode('next')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'next' ? 'bg-pink-600 text-white shadow-md shadow-pink-100' : 'text-gray-400 hover:text-pink-600'
              }`}
            >
              Próximos
            </button>
            <button
              type="button"
              onClick={() => setMode('week')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'week' ? 'bg-pink-600 text-white shadow-md shadow-pink-100' : 'text-gray-400 hover:text-pink-600'
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {mode === 'week' ? (
        <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b border-pink-50 bg-pink-50/30">
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 capitalize">{format(selectedDay, 'MMMM yyyy', { locale: ptBR })}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Agenda da Semana</p>
            </div>
            <p className="text-[10px] font-bold text-gray-400">
              {format(weekDays[0], 'dd/MM', { locale: ptBR })} – {format(weekDays[6], 'dd/MM', { locale: ptBR })}
            </p>
          </div>
          <div
            className="px-4 py-4"
          >
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-10 rounded-full bg-pink-100 overflow-hidden relative">
                  <motion.div 
                    animate={{ x: [0, 16, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="h-full w-4 rounded-full bg-pink-500" 
                  />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 animate-pulse">Arraste para trocar de semana</p>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => goToWeek(-1)}
                  className="p-1.5 hover:bg-pink-50 rounded-lg text-pink-400 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => goToWeek(1)}
                  className="p-1.5 hover:bg-pink-50 rounded-lg text-pink-400 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="relative">
              <div 
                ref={scrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide snap-always"
                onScroll={(e) => {
                  if (isChangingWeek.current) return;

                  const container = e.currentTarget;
                  const scrollLeft = container.scrollLeft;
                  const width = container.offsetWidth;

                  // Exigimos que o usuário role pelo menos 70% da semana para trocar
                  // Isso evita que movimentos bruscos pulem várias semanas
                  if (scrollLeft > width * 1.7) {
                    goToWeek(1);
                  }
                  else if (scrollLeft < width * 0.3) {
                    goToWeek(-1);
                  }
                }}
              >
                {weekDays.map((day, idx) => {
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDay);
                  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  const dayLabel = dayLabels[day.getDay()] || format(day, 'EEE', { locale: ptBR });
                  
                  return (
                    <div 
                        key={day.toISOString()}
                        className={`flex-shrink-0 w-[14.2857%] p-1 ${idx % 7 === 0 ? 'snap-start' : ''}`}
                      >
                      <button
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`w-full rounded-2xl border-2 py-3 text-center transition-all active:scale-[0.95] ${
                          isSelected
                            ? 'border-pink-600 bg-pink-50/30 shadow-sm'
                            : isToday
                              ? 'border-pink-200 bg-white'
                              : 'border-gray-100 hover:border-pink-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center gap-1">
                          <p className={`text-[9px] font-black uppercase tracking-widest leading-none ${isSelected ? 'text-pink-600' : 'text-gray-400'}`}>{dayLabel}</p>
                          <p className={`text-base font-black leading-none ${isSelected ? 'text-pink-700' : 'text-gray-900'}`}>{format(day, 'd', { locale: ptBR })}</p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-[10px] font-bold text-gray-400">{selectedDayAppointments.length} agendamentos</p>
            </div>

            <div className="mt-4 space-y-2">
              {selectedDayAppointments.length === 0 ? (
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-3">
                    <Calendar size={28} />
                  </div>
                  <p className="text-gray-400 font-medium">Nenhum agendamento neste dia.</p>
                </div>
              ) : (
                selectedDayAppointments.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center justify-between p-4 bg-white border border-pink-50 rounded-3xl hover:border-pink-200 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 overflow-hidden text-xs font-bold">
                        {format(safeToDate(app.start_time || app.data_hora) || new Date(), 'HH:mm')}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">{app.user_nome}</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-medium truncate max-w-[180px]">
                          {app.service_nome || (app.services && app.services.map((s) => s.nome || s.name).join(' + '))}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                      (app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado') ? 'bg-green-100 text-green-700' :
                      app.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      (app.status === 'cancelado' || app.status === 'cancelled') ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : nextAppointment ? (
        <div className="space-y-3">
          <UpcomingAppointmentCard 
            appointment={nextAppointment} 
            onClick={() => {
              setSelectedApp(nextAppointment);
              setIsModalOpen(true);
            }}
          />

          {otherUpcoming.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Próximos em seguida</p>
              {otherUpcoming.map(app => (
                <div 
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center justify-between p-4 bg-white border border-pink-50 rounded-3xl hover:border-pink-200 transition-all cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 overflow-hidden text-xs font-bold">
                      {format(app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora), "HH:mm")}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{app.user_nome}</h4>
                      <p className="text-[10px] text-gray-500 uppercase font-medium truncate max-w-[150px]">
                        {app.service_nome || (app.services && app.services.map(s => s.nome || s.name).join(' + '))}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-pink-400">
                    {format(app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora), "dd/MM")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
            <Calendar size={32} />
          </div>
          <p className="text-gray-400 font-medium">Nenhum próximo agendamento encontrado.</p>
          <p className="text-xs text-gray-300 mt-1">Sua agenda está livre por enquanto!</p>
        </div>
      )}

      <AppointmentDetailsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedApp}
        onCancel={handleCancel}
        onComplete={handleComplete}
      />
    </div>
  );
};

export default NextAppointmentSection;
