import { BadgeCheck, Clock3, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react';
import BookingCTA from '../../BookingCTA';
import InstagramLink from '../../InstagramLink';
import WhatsAppButton from '../../WhatsAppButton';

export default function LegacyLayout({
  establishment,
  onBookClick,
  settings
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || establishment.descricao;
  
  const heroSubtitle = 'Página profissional da estética';
  const badgeText = 'Agendamento online seguro';
  const experienceText = 'Experiência premium';
  const welcomeText = 'Atendimento profissional e acolhedor';

  const bannerStyle = bannerUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(190, 24, 93, 0.38)), url(${bannerUrl})`
      }
    : {
        backgroundImage:
          'radial-gradient(circle at top left, rgba(251, 207, 232, 0.95), transparent 32%), linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(88, 28, 135, 0.9) 55%, rgba(225, 29, 72, 0.82))'
      };

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-slate-950 px-5 py-6 text-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.8)] sm:rounded-[2.5rem] sm:px-8 sm:py-8"
      style={{
        ...bannerStyle,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_24%)]" />
      <div className="relative space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
          <Sparkles size={14} />
          <span>{heroSubtitle}</span>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/90 shadow-lg shadow-black/20">
                {establishment.logo_url ? (
                  <img
                    src={establishment.logo_url}
                    alt={establishment.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-black text-slate-800">
                    {establishment.nome.charAt(0)}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <BadgeCheck size={14} />
                  <span>{badgeText}</span>
                </div>
                <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  {establishment.nome}
                </h1>
              </div>
            </div>

            {settings?.showDescription !== false && (
              <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                {description}
              </p>
            )}

            <div className="grid gap-3 text-sm text-white/85 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-pink-200" />
                <span>{establishment.endereco || 'Endereço em destaque no perfil da estética'}</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 size={16} className="mt-0.5 text-pink-200" />
                <span>{establishment.horario_funcionamento}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-4 backdrop-blur md:min-w-[260px]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} className="text-emerald-200" />
              <span>{experienceText}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
              <Star size={14} className="fill-amber-300 text-amber-300" />
              <span>{welcomeText}</span>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <BookingCTA onClick={onBookClick} />
              <WhatsAppButton phone={establishment.telefone} className="w-full" />
              <InstagramLink instagram={establishment.instagram} className="w-full" compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
