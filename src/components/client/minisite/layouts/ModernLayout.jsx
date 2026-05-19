import React from 'react';
import { MapPin, Clock3, Instagram, Phone, ArrowUpRight, Zap, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ModernLayout({
  establishment,
  onBookClick,
  settings,
  palette
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Transformando beleza em arte. ✨';

  return (
    <div className="relative h-full w-full flex flex-col bg-white rounded-[2.5rem] overflow-hidden font-sans">
      {/* 1. Dynamic Hero Section */}
      <div className="relative h-[40%] shrink-0 overflow-hidden">
        <motion.div 
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-full h-full"
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${palette.gradient}`} />
          )}
        </motion.div>
        
        {/* Overlay Gradiente Moderno */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/20" />
        
        {/* Badge Flutuante */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-xl flex items-center gap-2 border border-white/20"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Disponível Hoje</span>
        </motion.div>
      </div>

      {/* 2. Brand Identity & Card */}
      <div className="relative z-10 -mt-20 flex-1 flex flex-col px-6 pb-8 min-h-0">
        
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 flex flex-col items-center text-center border border-slate-50"
        >
          {/* Logo Circular com Glow */}
          <div className="relative -mt-24 mb-6">
            <div className={`absolute inset-0 rounded-full blur-2xl opacity-30 ${palette.primary}`} />
            <div className="relative w-32 h-32 rounded-full p-1.5 bg-white shadow-2xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 flex items-center justify-center">
                {establishment.logo_url ? (
                  <img src={establishment.logo_url} alt={establishment.nome} className="h-full w-full object-cover" />
                ) : (
                  <span className={`text-4xl font-black ${palette.accent}`}>{establishment.nome?.charAt(0)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="space-y-1">
              <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${palette.accent}`}>Profissional Certificada</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {establishment.nome}
              </h1>
            </div>
            {settings?.showDescription !== false && (
              <p className="text-sm font-medium text-slate-500 leading-relaxed px-2">
                {description}
              </p>
            )}
          </div>

          {/* Action Grid - Modern Dynamic Blocks */}
          <div className="w-full space-y-3">
            <motion.button
              whileHover={{ scale: 1.02, translateY: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBookClick}
              className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 relative overflow-hidden group ${palette.button}`}
            >
              <Zap size={18} className="fill-current" />
              Agendar Agora
              <ArrowUpRight size={18} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </motion.button>

            <div className="grid grid-cols-2 gap-3">
              <motion.a 
                whileHover={{ y: -2 }}
                href={`https://wa.me/${establishment.telefone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 transition-all hover:bg-white hover:shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Phone size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
              </motion.a>
              <motion.a 
                whileHover={{ y: -2 }}
                href={`https://instagram.com/${establishment.instagram?.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 transition-all hover:bg-white hover:shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
                  <Instagram size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Instagram</span>
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Minimal Info Badges */}
        <div className="mt-auto pt-6 flex justify-center gap-4">
          <div className="px-4 py-2 bg-slate-100/50 rounded-full flex items-center gap-2">
            <MapPin size={12} className="text-slate-400" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
              {establishment.endereco?.split(',')[0] || 'Localização'}
            </span>
          </div>
          <div className="px-4 py-2 bg-slate-100/50 rounded-full flex items-center gap-2">
            <Clock3 size={12} className="text-slate-400" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
              {establishment.horario_funcionamento?.split(' • ')[0] || 'Disponível'}
            </span>
          </div>
        </div>

      </div>

      {/* Efeito Visual de Background */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-slate-50 -z-0" />
    </div>
  );
}
