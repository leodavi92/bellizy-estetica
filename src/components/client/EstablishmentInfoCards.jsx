import {
  Clock3,
  FileCheck2,
  Instagram,
  MapPin,
  MessageCircleMore
} from 'lucide-react';
import { getInstagramUrl, getWhatsAppUrl } from '../../services/establishmentService';

const cards = [
  {
    key: 'telefone',
    title: 'WhatsApp',
    icon: MessageCircleMore
  },
  {
    key: 'instagram',
    title: 'Instagram',
    icon: Instagram
  },
  {
    key: 'endereco',
    title: 'Endereco',
    icon: MapPin
  },
  {
    key: 'horario_funcionamento',
    title: 'Horario',
    icon: Clock3
  },
  {
    key: 'politica_cancelamento',
    title: 'Cancelamento',
    icon: FileCheck2
  }
];

export default function EstablishmentInfoCards({ establishment }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pink-600">
            Informacoes Rapidas
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            Tudo o que a cliente precisa para confiar e agendar
          </h2>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const content = establishment[card.key];

          let href = '';
          if (card.key === 'telefone') href = getWhatsAppUrl(content);
          if (card.key === 'instagram') href = getInstagramUrl(content);

          const text =
            card.key === 'instagram' && content
              ? content.startsWith('@')
                ? content
                : `@${content}`
              : content;

          return (
            <article
              key={card.key}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_55px_-24px_rgba(15,23,42,0.45)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                <Icon size={20} />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {card.title}
              </p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-sm font-semibold leading-6 text-slate-800 transition-colors hover:text-pink-600"
                >
                  {text}
                </a>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
