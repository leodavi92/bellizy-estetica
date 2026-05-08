import { Instagram } from 'lucide-react';
import { getInstagramUrl } from '../../services/establishmentService';

export default function InstagramLink({ instagram, className = '', compact = false }) {
  const href = getInstagramUrl(instagram);

  if (!href) return null;

  const handle = instagram?.startsWith('@') ? instagram : `@${instagram}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-pink-200 hover:text-pink-600 ${className}`}
    >
      <Instagram size={16} />
      <span>{compact ? 'Instagram' : handle}</span>
    </a>
  );
}
