import React from 'react';
import { 
  Heart, 
  Star, 
  MessageCircle, 
  Instagram, 
  MapPin, 
  Clock3, 
  ChevronRight,
  Sparkles,
  Flower2,
  Share2
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function SilkRoseLayout({
  establishment,
  onBookClick,
  settings,
  palette,
  services: realServices
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Onde a delicadeza encontra a alta performance. Sua beleza tratada com o carinho que ela merece.';

  const roseColors = {
    bg: 'bg-[#FFF5F7]', // Blush Pink Ultra Light
    accent: 'text-[#D4AF37]', // Soft Gold
    button: 'bg-gradient-to-r from-rose-400 to-pink-300 text-white shadow-[0_10px_30px_rgba(251,113,133,0.3)]',
    card: 'bg-white/80 backdrop-blur-md border-rose-100 shadow-sm'
  };

  const displayServices = realServices && realServices.length > 0
    ? realServices.slice(0, 3)
    : [
        { id: '1', nome: 'Cuidado Facial Silk', desc: 'Pele macia como seda com ativos importados.', img: 'https://images.unsplash.com/photo-1570172619996-23b241a2f390?auto=format&fit=crop&q=80&w=400' },
        { id: '2', nome: 'Olhar de Boneca', desc: 'Design estratégico que realça sua feminilidade.', img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400' },
        { id: '3', nome: 'Spa Day Relax', desc: 'Um refúgio de paz e autocuidado completo.', img: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&q=80&w=400' }
      ];

  return (
    <div className={`relative h-full w-full flex flex-col ${roseColors.bg} rounded-[2.5rem] overflow-hidden font-['Montserrat'] text-rose-900`}>
      
      {/* 1. Background de Seda (Pano de Fundo) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=1200" 
          alt="Silk Background" 
          className="w-full h-full object-cover opacity-20 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-[#FFF5F7]" />
      </div>

      {/* 2. Elementos Flutuantes (Pétalas) */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -100, x: Math.random() * 300, rotate: 0 }}
            animate={{ 
              y: 800, 
              x: (Math.random() * 300) + (i * 20),
              rotate: 360 
            }}
            transition={{ 
              duration: 15 + (Math.random() * 10), 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 3
            }}
            className="absolute opacity-30"
          >
            <Flower2 size={24} className="text-rose-300 fill-rose-100" />
          </motion.div>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-20">
        
        {/* 3. Hero Section - Soft & Feminine */}
        <section className="relative h-[65vh] flex flex-col justify-end p-8 overflow-hidden">
          <div className="absolute inset-0 z-0">
            {bannerUrl ? (
              <motion.img 
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 10 }}
                src={bannerUrl} 
                alt="Hero" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-rose-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FFF5F7] via-[#FFF5F7]/40 to-transparent" />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative z-10 space-y-6"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 backdrop-blur-md rounded-full border border-rose-200">
                <Heart size={12} className="text-rose-400 fill-rose-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Sua melhor versão começa aqui</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-['Playfair_Display'] font-black leading-none tracking-tight text-rose-950">
                Beleza que <br />
                <span className="italic font-normal text-rose-500">floresce</span> <br />
                em você
              </h1>
            </div>

            {settings?.showDescription !== false && (
              <p className="text-xs font-medium text-rose-700/70 leading-relaxed max-w-[260px]">
                {description}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBookClick}
              className={`w-full py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${roseColors.button}`}
            >
              Agendar Experiência
            </motion.button>
          </motion.div>
        </section>

        {/* 4. Soft Social Proof */}
        <div className="bg-white/40 backdrop-blur-sm py-4 border-y border-rose-100 overflow-hidden">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="flex gap-12 whitespace-nowrap px-6"
          >
            {['Cuidado com Alma', 'Resultados Delicados', 'Ambiente Acolhedor', 'Especialista em Você'].map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <Sparkles size={14} className="text-rose-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{text}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* 5. Delicate Services Grid */}
        <section className="px-6 py-16 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-['Playfair_Display'] font-bold text-rose-900">Nossos Mimos</h2>
            <div className="h-1 w-12 mx-auto bg-rose-200 rounded-full" />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {displayServices.map((service, idx) => (
              <motion.button
                key={service.id || idx}
                onClick={() => onBookClick(service.id)}
                whileHover={{ y: -5 }}
                className={`relative w-full h-56 rounded-[2.5rem] overflow-hidden border border-rose-100 group shadow-sm text-left`}
              >
                <img src={service.img || 'https://images.unsplash.com/photo-1570172619996-23b241a2f390?auto=format&fit=crop&q=80&w=400'} alt={service.nome} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-rose-900/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 space-y-1">
                  <h3 className="text-xl font-bold text-white">{service.nome}</h3>
                  <p className="text-[10px] text-white/80 font-medium leading-tight">{service.desc || 'Toque de seda para sua pele.'}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* 6. Footer - Sweet Contact */}
        <section className="p-8 space-y-12">
          <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-8 border border-rose-100 space-y-8">
            <div className="space-y-6">
              <h3 className="text-2xl font-['Playfair_Display'] font-bold text-rose-900">Visite nosso Studio</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Onde estamos</p>
                    <p className="text-sm font-bold text-rose-800">{establishment.endereco || 'Um lugar especial para você'}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                    <Clock3 size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Horários</p>
                    <p className="text-sm font-bold text-rose-800">{establishment.horario_funcionamento || 'Consulte sua disponibilidade'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <a 
                href={`https://wa.me/${establishment.telefone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-5 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <MessageCircle size={20} fill="currentColor" />
                Falar com a gente
              </a>
              <div className="flex gap-3">
                <a 
                  href={`https://instagram.com/${establishment.instagram?.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center py-4 rounded-full bg-white border border-rose-100 text-rose-400"
                >
                  <Instagram size={24} />
                </a>
                <div className="w-16 flex items-center justify-center rounded-full bg-white border border-rose-100 text-rose-400">
                  <Share2 size={20} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-8 flex flex-col items-center gap-4 opacity-40">
             <span className="text-[9px] font-black uppercase tracking-[0.4em] text-rose-300 text-center">Silk Rose Experience Layout</span>
             <p className="text-[8px] font-black uppercase tracking-widest text-rose-200">Powered by Bellizy</p>
          </div>
        </section>

      </div>

      {/* Floating Heart Button */}
      <motion.a
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        href={`https://wa.me/${establishment.telefone?.replace(/\D/g, '')}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-8 right-8 w-16 h-16 bg-rose-500 text-white rounded-full shadow-2xl flex items-center justify-center z-50 lg:hidden border-4 border-white"
      >
        <Heart size={32} fill="currentColor" />
      </motion.a>

    </div>
  );
}
