import React from 'react';
import { MapPin, Clock3, Instagram, Phone, Sparkles, ChevronRight, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getWhatsAppUrl, getInstagramUrl } from '../../../../services/establishmentService';

export default function LuxuryLayout({
  establishment,
  onBookClick,
  settings,
  palette
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Atendimento personalizado com foco em autoestima e excelência.';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-950 rounded-[2.5rem] overflow-hidden text-white font-serif">
      {/* 1. Background Imersivo com Gradiente de Profundidade */}
      <div className="absolute inset-0 z-0">
        {bannerUrl ? (
          <>
            <motion.img 
              initial={{ scale: 1.2 }}
              animate={{ scale: 1.1 }}
              transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
              src={bannerUrl} 
              alt="bg" 
              className="w-full h-full object-cover blur-[2px] opacity-40" 
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-950" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${palette.gradient} opacity-20`} />
        )}
      </div>

      {/* 2. Conteúdo Principal */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex-1 flex flex-col px-8 pt-24 pb-10 overflow-y-auto no-scrollbar"
      >
        {/* Top Header - HUMAN IDENTITY FOCUS */}
        <motion.div 
          variants={itemVariants} 
          className={`flex flex-col items-center ${settings?.showDescription !== false ? 'mb-12' : 'mb-16'}`}
        >
          <div className="relative mb-8 group">
            <div className={`absolute inset-0 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-700 ${palette.primary}`} />
            <div className={`relative w-32 h-32 rounded-full p-[2px] bg-gradient-to-tr ${palette.gradient}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center p-1">
                {establishment.photoURL || establishment.logo_url ? (
                  <img src={establishment.photoURL || establishment.logo_url} alt={establishment.nome} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <span className={`text-4xl font-light tracking-tighter ${palette.accent}`}>{establishment.nome?.charAt(0)}</span>
                )}
              </div>
            </div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-3 border border-dashed border-white/5 rounded-full pointer-events-none" 
            />
            
            {/* Badge de Especialista */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="absolute -bottom-2 -right-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full p-2 shadow-2xl"
            >
              <Sparkles size={16} className={palette.accent} />
            </motion.div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="space-y-1">
              <span className={`text-[10px] font-black uppercase tracking-[0.5em] ${palette.accent} opacity-80`}>Personal Brand</span>
              <h1 className="text-4xl font-light tracking-[0.15em] uppercase leading-tight text-white drop-shadow-sm">
                {establishment.nome}
              </h1>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-3">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-white/30" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">Especialista em Estética Avançada</span>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-white/30" />
              </div>
              <span className="text-[9px] font-medium text-white/40 uppercase tracking-[0.3em]">Atendimento Premium Personalizado</span>
            </div>
          </div>
        </motion.div>

        {/* Bio Section */}
        {settings?.showDescription !== false && (
          <motion.div variants={itemVariants} className="mb-12 text-center">
            <p className="text-sm font-light text-slate-300 italic leading-relaxed max-w-[280px] mx-auto opacity-80">
              "{description}"
            </p>
          </motion.div>
        )}

        {/* Premium Action Cards */}
        <div className={`space-y-4 ${settings?.showDescription !== false ? '' : 'mt-4'}`}>
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBookClick}
            className={`group relative w-full py-6 rounded-2xl overflow-hidden shadow-2xl transition-all ${palette.button}`}
          >
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            <div className="relative flex items-center justify-center gap-3">
              <span className="font-bold text-xs uppercase tracking-[0.4em]">Reservar Experiência</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
            <a 
              href={getWhatsAppUrl(establishment.telefone)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all group"
            >
              <Phone size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Concierge</span>
            </a>
            <a 
              href={getInstagramUrl(establishment.instagram)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all group"
            >
              <Instagram size={18} className="text-pink-400 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Galeria</span>
            </a>
          </motion.div>
        </div>

        {/* Elegant Footer Meta */}
        <motion.div variants={itemVariants} className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <MapPin size={12} className={palette.accent} />
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
                {establishment.endereco?.split(',')[0] || 'Studio Exclusive'}
              </span>
            </div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-2">
              <Clock3 size={12} className={palette.accent} />
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
                {establishment.horario_funcionamento?.split(' • ')[0] || 'Aberto'}
              </span>
            </div>
          </div>
          <p className="text-[8px] font-bold uppercase tracking-[0.5em] text-white/20">Powered by Bellizy</p>
        </motion.div>
      </motion.div>

      {/* 3. Floating Sparkle Elements */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.4, 0],
              y: [0, -100],
              x: Math.random() * 40 - 20
            }}
            transition={{ 
              duration: 4 + Math.random() * 4, 
              repeat: Infinity,
              delay: Math.random() * 5
            }}
            style={{ 
              left: `${Math.random() * 100}%`,
              bottom: `-10%`,
            }}
            className={`absolute w-1 h-1 rounded-full ${palette.primary} blur-[1px]`}
          />
        ))}
      </div>
    </div>
  );
}
