import React from 'react';
import { MapPin, Clock3, Instagram, Phone, Sparkles, ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PremiumBalanceLayout({
  establishment,
  onBookClick,
  settings,
  palette
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Elevando sua beleza com técnica e sofisticação.';

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-50 rounded-[2.5rem] overflow-hidden font-sans">
      {/* 1. Sophisticated Hero */}
      <div className="relative h-[30%] shrink-0">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${palette.gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-slate-50" />
      </div>

      {/* 2. Balanced Content Area */}
      <div className="relative z-10 -mt-12 flex-1 flex flex-col px-6 pb-8 min-h-0">
        
        <div className={`flex flex-col items-center text-center ${settings?.showDescription !== false ? 'mb-8' : 'mb-12'}`}>
          {/* Avatar com Ring Elegante */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${palette.primary}`} />
            <div className={`relative w-32 h-32 rounded-full p-1 bg-white shadow-2xl`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 flex items-center justify-center">
                {establishment.photoURL || establishment.logo_url ? (
                  <img src={establishment.photoURL || establishment.logo_url} alt={establishment.nome} className="h-full w-full object-cover" />
                ) : (
                  <User size={48} className={palette.accent} />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {establishment.nome}
            </h1>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-100 shadow-sm`}>
              <Sparkles size={12} className={palette.accent} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Premium Experience</span>
            </div>
          </div>
        </div>

        {/* Bio Card */}
        {settings?.showDescription !== false && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-8 text-center">
            <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
              "{description}"
            </p>
          </div>
        )}

        {/* Balanced Actions */}
        <div className={`space-y-3 ${settings?.showDescription !== false ? 'mt-auto' : 'mt-4'}`}>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onBookClick}
            className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 ${palette.button}`}
          >
            Agendar Atendimento
            <ChevronRight size={18} />
          </motion.button>

          <div className="grid grid-cols-2 gap-3">
            <a 
              href={`https://wa.me/${establishment.telefone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white border border-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
            >
              <Phone size={18} className="text-emerald-500" />
              Contato
            </a>
            <a 
              href={`https://instagram.com/${establishment.instagram?.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white border border-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
            >
              <Instagram size={18} className="text-pink-500" />
              Instagram
            </a>
          </div>
        </div>

        {/* Info Badges */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <MapPin size={14} className="text-slate-300" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
              {establishment.endereco?.split(',')[0] || 'Studio'}
            </span>
          </div>
          <div className="w-px h-6 bg-slate-100" />
          <div className="flex flex-col items-center gap-1">
            <Clock3 size={14} className="text-slate-300" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
              {establishment.horario_funcionamento?.split(' • ')[0] || 'Horários'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
