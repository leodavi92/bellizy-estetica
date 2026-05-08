import { ArrowRight, CalendarHeart } from 'lucide-react';

export default function BookingCTA({ onClick, serviceName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 px-6 py-4 text-sm font-semibold text-white shadow-2xl shadow-pink-300/50 transition-all hover:-translate-y-0.5 hover:shadow-pink-300/70"
    >
      <CalendarHeart size={18} />
      <span>{serviceName ? `Agendar ${serviceName}` : 'Agendar horario'}</span>
      <ArrowRight size={16} />
    </button>
  );
}
