import { MessageCircleMore } from 'lucide-react';
import { getWhatsAppUrl } from '../../services/establishmentService';

export default function WhatsAppButton({
  phone,
  label = 'Conversar no WhatsApp',
  className = '',
  variant = 'primary'
}) {
  const href = getWhatsAppUrl(phone);

  if (!href) return null;

  const styles =
    variant === 'secondary'
      ? 'bg-white text-slate-800 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
      : 'bg-slate-950 text-white hover:bg-slate-800 shadow-xl shadow-slate-300/40';

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 ${styles} ${className}`}
    >
      <MessageCircleMore size={18} />
      <span>{label}</span>
    </a>
  );
}
