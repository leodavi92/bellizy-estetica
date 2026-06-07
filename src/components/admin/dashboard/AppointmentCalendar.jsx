import React, { useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { APPOINTMENT_STATUS, normalizeStatus } from '../../../services/appointmentService';

const AppointmentCalendar = ({ appointments, selectedDate, onDateSelect }) => {
  const [viewDate, setViewDate] = React.useState(selectedDate || new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  }, [viewDate]);

  const getAppointmentsForDay = (day) => {
    return appointments.filter(app => {
      const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
      return isSameDay(appDate, day);
    });
  };

  const getStatusColor = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-blue-500';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-500';
      case APPOINTMENT_STATUS.SCHEDULED:
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-pink-500';
      default:
        return 'bg-gray-400';
    }
  };

  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const prevMonth = () => setViewDate(subMonths(viewDate, 1));

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="p-6 border-b border-pink-50 flex items-center justify-between bg-pink-50/30">
        <button 
          onClick={prevMonth}
          className="p-2 hover:bg-white rounded-xl transition-colors text-pink-600 shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-gray-800 capitalize">
          {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <button 
          onClick={nextMonth}
          className="p-2 hover:bg-white rounded-xl transition-colors text-pink-600 shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 border-b border-pink-50">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, viewDate);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={idx}
              onClick={() => onDateSelect(day)}
              className={`min-h-[80px] sm:min-h-[100px] p-2 border-r border-b border-pink-50 transition-all cursor-pointer relative hover:bg-pink-50/40 ${
                !isCurrentMonth ? 'bg-gray-50/30 opacity-40' : 
                dayAppointments.length > 0 ? 'bg-pink-50/10' : 'bg-white'
              } ${isSelected ? 'z-10' : ''}`}
            >
              {/* Selected Highlight */}
              {isSelected && (
                <div className="absolute inset-0 border-2 border-pink-500 rounded-lg pointer-events-none" />
              )}

              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  !isCurrentMonth ? 'text-gray-300' : 
                  isToday ? 'bg-pink-600 text-white shadow-md shadow-pink-200' : 
                  isSelected ? 'text-pink-600' : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Appointment Dots Container */}
              <div className="flex justify-center mt-auto">
                {dayAppointments.length > 0 && (
                  <div 
                    className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                      dayAppointments.some(app => {
                        const s = normalizeStatus(app.status);
                        return s === APPOINTMENT_STATUS.SCHEDULED || s === APPOINTMENT_STATUS.CONFIRMED;
                      }) ? 'bg-pink-500' :
                      dayAppointments.some(app => normalizeStatus(app.status) === APPOINTMENT_STATUS.COMPLETED) ? 'bg-blue-500' :
                      'bg-red-500'
                    }`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 border-t border-pink-50 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase">Agendado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase">Finalizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase">Cancelado</span>
        </div>
      </div>
    </div>
  );
};

export default AppointmentCalendar;
