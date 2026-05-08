import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3
} from 'lucide-react';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
export default function ScheduleSection({
  selectedService,
  selectedServices = [],
  totalDuration = 0,
  totalPrice = 0,
  selectedDate,
  setSelectedDate,
  availableSlots,
  loadingSlots,
  onBook,
  onBack,
  currentMonth,
  setCurrentMonth,
  checkDayAvailability
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd)
  });

  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  return (
    <section className="space-y-5 rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_65px_-28px_rgba(15,23,42,0.35)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            {(selectedServices.length > 0 ? selectedServices : [selectedService]).map((s, idx) => (
              <span key={idx} className="inline-flex items-center rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-bold text-pink-700 border border-pink-100">
                {s?.nome}
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Escolha o melhor horário
          </h2>
          <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Clock3 size={14} className="text-pink-500" />
              {totalDuration || selectedService?.duracao} min total
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-pink-600 font-bold">
              {formatPrice(totalPrice || selectedService?.preco)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
        >
          <ArrowLeft size={16} />
          <span>Alterar serviços</span>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays size={16} className="text-pink-600" />
              <span>{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-pink-200 hover:text-pink-600"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-pink-200 hover:text-pink-600"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = isSameDay(day, selectedDate);
              const hasAvailability = isCurrentMonth && checkDayAvailability(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!isCurrentMonth}
                  onClick={() => setSelectedDate(day)}
                  className={`relative aspect-square rounded-2xl text-sm font-semibold transition-all ${
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
                    <span className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-pink-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 size={16} className="text-pink-600" />
            <span>{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</span>
          </div>

          {loadingSlots ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableSlots.map((slot) => (
                <button
                  key={slot.toISOString()}
                  type="button"
                  onClick={() => onBook(slot)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-pink-300 hover:bg-pink-600 hover:text-white"
                >
                  {format(slot, 'HH:mm')}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm leading-6 text-slate-500">
                Nao encontramos horarios livres nessa data. Escolha outro dia ou fale direto com a estetica.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
