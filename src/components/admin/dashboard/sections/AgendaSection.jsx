import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  X,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import AppointmentCalendar from '../AppointmentCalendar';
import { APPOINTMENT_STATUS, normalizeStatus } from '../../../../services/appointmentService';

const safeToDate = val => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return new Date();
};

const AgendaSection = ({
  user,
  agendaView,
  setAgendaView,
  professionalFilter,
  setProfessionalFilter,
  allProfessionals,
  allAppointments,
  selectedDate,
  setSelectedDate,
  setManualAppData,
  setIsManualAppModalOpen,
  appointments,
  setSelectedApp,
  setIsAppDetailsModalOpen,
  handleCancelAppointment,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Agenda</h2>
          <p className="text-gray-500 font-medium">Visualize e gerencie todos os agendamentos.</p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-pink-100 w-fit shadow-sm">
          <button
            onClick={() => setAgendaView('list')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              agendaView === 'list'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-100'
                : 'text-gray-400 hover:text-pink-600'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setAgendaView('calendar')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              agendaView === 'calendar'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-100'
                : 'text-gray-400 hover:text-pink-600'
            }`}
          >
            Calendário
          </button>
        </div>
      </div>

      {user?.tipo !== 'staff' && (
        <div className="bg-white p-4 rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setProfessionalFilter('all')}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                professionalFilter === 'all'
                  ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-100'
                  : 'bg-white border-gray-100 text-gray-400 hover:border-pink-200'
              }`}
            >
              Toda a Equipe
            </button>
            {allProfessionals.map(p => (
              <button
                key={p.id}
                onClick={() => setProfessionalFilter(p.id)}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  professionalFilter === p.id
                    ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-100'
                    : 'bg-white border-gray-100 text-gray-400 hover:border-pink-200'
                }`}
              >
                {p.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {agendaView === 'calendar' ? (
        <div className="animate-in zoom-in-95 duration-300">
          <AppointmentCalendar
            appointments={allAppointments}
            selectedDate={selectedDate}
            onDateSelect={date => {
              setSelectedDate(date);
              setAgendaView('list');
            }}
          />
        </div>
      ) : (
        <>
          <div className="bg-white p-4 sm:p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 1);
                  setSelectedDate(newDate);
                }}
                className="p-2 hover:bg-pink-50 rounded-full transition-colors text-pink-600"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="text-center min-w-[140px]">
                <h3 className="text-xl font-bold text-gray-800">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs text-pink-600 font-bold uppercase tracking-widest">
                  {format(selectedDate, 'EEEE', { locale: ptBR })}
                </p>
              </div>
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 1);
                  setSelectedDate(newDate);
                }}
                className="p-2 hover:bg-pink-50 rounded-full transition-colors text-pink-600"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <button
              onClick={() => {
                setManualAppData(prev => ({
                  ...prev,
                  data_hora: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
                  professional_id: user?.tipo === 'staff' ? user.professional_id : '',
                }));
                setIsManualAppModalOpen(true);
              }}
              className="w-full sm:w-auto bg-slate-950 text-white px-5 py-4 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Agendar Manual</span>
            </button>
          </div>

          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-pink-100">
                <Calendar size={48} className="mx-auto text-pink-100 mb-4" />
                <p className="text-gray-400">Nenhum agendamento nesta data.</p>
              </div>
            ) : (
              appointments.map(app => {
                const isCombo =
                  app.services && Array.isArray(app.services) && app.services.length > 1;
                const staffView = user?.tipo === 'staff';
                const myServiceInCombo =
                  staffView && isCombo
                    ? app.services.find(s => s.professional_id === user.professional_id)
                    : null;

                const appStartTime = myServiceInCombo
                  ? myServiceInCombo.start_time?.toDate
                    ? myServiceInCombo.start_time.toDate()
                    : new Date(myServiceInCombo.start_time)
                  : safeToDate(app.data_hora);

                const isValidDate =
                  appStartTime instanceof Date && !isNaN(appStartTime.getTime());
                const appDuration = myServiceInCombo
                  ? myServiceInCombo.duracao
                  : app.duration;

                return (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app);
                      setIsAppDetailsModalOpen(true);
                    }}
                    className={`bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-2 shadow-sm transition-all cursor-pointer hover:border-pink-200 ${
                      normalizeStatus(app.status) === APPOINTMENT_STATUS.CANCELLED
                        ? 'opacity-50 grayscale border-gray-100'
                        : 'border-pink-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3 sm:gap-6 items-center">
                        <div className="text-center min-w-[60px] sm:min-w-[70px] border-r border-pink-100 pr-3 sm:pr-6">
                          <span className="block text-xl sm:text-2xl font-black text-pink-600">
                            {isValidDate ? format(appStartTime, 'HH:mm') : '--:--'}
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                            {appDuration} MIN
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-gray-800">{app.user_nome}</h3>
                            <div className="flex gap-1.5">
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  normalizeStatus(app.status) ===
                                    APPOINTMENT_STATUS.SCHEDULED ||
                                  normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED
                                    ? 'bg-green-100 text-green-700'
                                    : normalizeStatus(app.status) === APPOINTMENT_STATUS.COMPLETED
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {normalizeStatus(app.status) === APPOINTMENT_STATUS.SCHEDULED
                                  ? 'Agendado'
                                  : normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED
                                    ? 'Confirmado'
                                    : normalizeStatus(app.status) === APPOINTMENT_STATUS.COMPLETED
                                      ? 'Finalizado'
                                      : 'Cancelado'}
                              </span>
                              {isCombo && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-600 text-white shadow-sm shadow-pink-100 flex items-center gap-1">
                                  <PlusCircle size={10} strokeWidth={3} /> Combo
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 flex items-center gap-1 font-medium">
                            <Sparkles size={14} className="text-pink-400" />{' '}
                            {myServiceInCombo
                              ? myServiceInCombo.service_nome || myServiceInCombo.nome
                              : app.service_nome}
                          </p>
                          {!staffView && app.professional_id && (
                            <p className="text-[10px] font-black text-pink-600 uppercase tracking-tighter mt-1 bg-pink-50 w-fit px-2 py-0.5 rounded-md">
                              {allProfessionals.find(p => p.id === app.professional_id)?.nome ||
                                'Profissional'}
                            </p>
                          )}
                          {staffView && isCombo && (
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                              Horário Global:{' '}
                              {isValidDate ? format(safeToDate(app.data_hora), 'HH:mm') : '--:--'}
                            </p>
                          )}
                        </div>
                      </div>
                      {(normalizeStatus(app.status) === APPOINTMENT_STATUS.SCHEDULED ||
                        normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED) && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleCancelAppointment(app.id);
                          }}
                          className="p-3 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-2xl transition-all"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AgendaSection;
