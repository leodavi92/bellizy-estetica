import React from 'react';
import { Sparkles, MapPin, Clock3, Star, Instagram, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EleganceLayout({
  establishment,
  onBookClick,
  settings,
  palette
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Experiência premium em estética avançada.';

  return (
    <div className="relative h-full w-full flex flex-col bg-white rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100">
      {/* Top Banner - Altura Elegante */}
      <div className="relative h-[25%] shrink-0 overflow-hidden">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${palette.gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
      </div>

      {/* Main Content Area - Distribuído e Proporcional */}
      <div className="relative flex-1 flex flex-col px-8 pb-20 -mt-24 min-h-0">
        <div className="flex-1 flex flex-col justify-start items-center text-center py-2 min-h-0 gap-12">
          
          {/* Logo & Identity - Elevado e com respiro inferior */}
          <div className="space-y-12 flex flex-col items-center shrink-0">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative shrink-0"
            >
              <div className={`w-32 h-32 rounded-[3rem] p-1 bg-gradient-to-tr ${palette.gradient} shadow-2xl`}>
                <div className="w-full h-full rounded-[2.8rem] p-1 bg-white">
                  <div className="w-full h-full rounded-[2.5rem] overflow-hidden bg-slate-50 flex items-center justify-center">
                    {establishment.logo_url ? (
                      <img src={establishment.logo_url} alt={establishment.nome} className="h-full w-full object-cover" />
                    ) : (
                      <span className={`text-4xl font-black ${palette.accent}`}>{establishment.nome?.charAt(0)}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                {establishment.nome}
              </h1>
              {settings?.showDescription !== false && (
                <p className="text-sm font-medium text-slate-400 max-w-[280px] mx-auto leading-relaxed italic line-clamp-2 px-4">
                  "{description}"
                </p>
              )}
            </div>
          </div>

          {/* Grouping Actions and Info - Maior e Imersivo */}
          <div className="w-full max-w-sm space-y-4">
            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={onBookClick}
                className={`w-full py-5 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-all active:scale-95 hover:brightness-110 ${palette.button}`}
              >
                Agendar Agora
              </button>
              
              <div className="grid grid-cols-2 gap-3 pt-6">
                <a 
                  href={`https://wa.me/${establishment.telefone?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-4 rounded-[2rem] bg-white border border-slate-100 shadow-sm font-black text-[9px] uppercase tracking-widest text-slate-600 transition-all active:scale-95 hover:bg-slate-50"
                >
                  <Phone size={14} className="text-emerald-500" />
                  WhatsApp
                </a>
                <a 
                  href={`https://instagram.com/${establishment.instagram?.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-4 rounded-[2rem] bg-white border border-slate-100 shadow-sm font-black text-[9px] uppercase tracking-widest text-slate-600 transition-all active:scale-95 hover:bg-slate-50"
                >
                  <Instagram size={14} className="text-pink-500" />
                  Instagram
                </a>
              </div>
            </div>

            {/* Secondary Info - Novo Design Premium */}
            <div className="w-full pt-2">
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col items-center gap-2 p-4 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] transition-all">
                  <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center bg-slate-50 ${palette.accent}`}>
                    <MapPin size={18} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300 mb-0.5">Localização</p>
                    <p className="text-[11px] font-black text-slate-900 line-clamp-1 italic leading-tight">
                      {establishment.endereco?.split(',')[0] || 'Novo Mundo'}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col items-center gap-2 p-4 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] transition-all">
                  <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center bg-slate-50 ${palette.accent}`}>
                    <Clock3 size={18} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300 mb-0.5">Aberto</p>
                    <p className="text-[11px] font-black text-slate-900 line-clamp-1 italic leading-tight">
                      {establishment.horario_funcionamento || 'Seg a Sab • 08:00'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
