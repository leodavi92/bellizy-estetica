import React from 'react';
import {
  MapPin, 
  Clock3, 
  Instagram, 
  Phone, 
  Sparkles, 
  ShieldCheck, 
  Leaf, 
  Star, 
  ChevronRight,
  MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getWhatsAppUrl, getInstagramUrl } from '../../../../services/establishmentService';

export default function AuraLayout({
  establishment,
  onBookClick,
  settings,
  palette,
  services: realServices
}) {
  const bannerUrl = settings?.bannerUrl || establishment.banner_url;
  const description = settings?.bioText || 'Realce sua essência natural com tratamentos de alta performance.';

  // Limita a 4 serviços reais ou usa placeholders se não houver nenhum
  const displayServices = realServices && realServices.length > 0 
    ? realServices.slice(0, 4) 
    : [
        { id: '1', nome: 'Limpeza de Pele' },
        { id: '2', nome: 'Design de Sobrancelhas' },
        { id: '3', nome: 'Depilação a Laser' },
        { id: '4', nome: 'Massagens Relaxantes' }
      ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  // Cores personalizadas do layout Aura (Nude, Areia, Dourado)
  const auraColors = {
    bg: 'bg-[#FDFBF7]', // Off-white/Areia claro
    card: 'bg-white',
    accent: 'text-[#C5A059]', // Dourado fosco
    button: 'bg-[#C5A059] hover:bg-[#B48F48] text-white',
    textMain: 'text-[#4A453E]', // Marrom acinzentado suave
    textMuted: 'text-[#8C857B]'
  };

  const differentials = [
    { icon: Sparkles, title: 'Atendimento Personalizado', desc: 'Cada detalhe pensado para você.' },
    { icon: ShieldCheck, title: 'Profissionais Certificados', desc: 'Excelência técnica e segurança.' },
    { icon: Leaf, title: 'Ambiente Climatizado', desc: 'Conforto e relaxamento total.' }
  ];

  const testimonials = [
    { name: 'Juliana Silva', text: 'A melhor experiência que já tive. O ambiente é impecável e o resultado foi surpreendente.', stars: 5 },
    { name: 'Mariana Costa', text: 'Profissionalismo e cuidado em cada etapa. Recomendo muito a limpeza de pele.', stars: 5 }
  ];

  return (
    <div className={`relative h-full w-full flex flex-col ${auraColors.bg} rounded-[2.5rem] overflow-hidden font-['Montserrat'] ${auraColors.textMain}`}>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        
        {/* 1. Hero Section */}
        <section className="relative h-[60vh] flex flex-col justify-end p-8 overflow-hidden">
          <div className="absolute inset-0 z-0">
            {bannerUrl ? (
              <img src={bannerUrl} alt="Hero" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${palette.gradient} opacity-20`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/40 to-transparent" />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`relative z-10 ${settings?.showDescription !== false ? 'space-y-6' : 'space-y-8'}`}
          >
            <div className="space-y-2">
              <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${auraColors.accent}`}>Bem-vinda ao seu refúgio</span>
              <h1 className="text-5xl font-['Playfair_Display'] font-black leading-[1.1] tracking-tight text-[#2D2A26]">
                Realce sua <br />
                <span className="italic font-normal">essência natural</span>
              </h1>
            </div>
            
            {settings?.showDescription !== false && (
              <p className={`text-sm font-medium ${auraColors.textMuted} max-w-[280px] leading-relaxed`}>
                {description}
              </p>
            )}

            <button
              onClick={onBookClick}
              className={`px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-[#C5A059]/20 transition-all active:scale-95 ${auraColors.button}`}
            >
              Agendar Horário
            </button>
          </motion.div>
        </section>

        {/* 2. Services Grid */}
        <section className="px-8 py-16 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-['Playfair_Display'] font-bold text-[#2D2A26]">Nossos Serviços</h2>
            <div className={`h-1 w-12 mx-auto bg-[#C5A059]/30 rounded-full`} />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {displayServices.map((service, idx) => (
              <motion.button
                key={service.id || idx}
                onClick={() => onBookClick(service.id)}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className={`w-full ${auraColors.card} p-6 rounded-[2rem] border border-[#F5F1EA] shadow-sm flex items-center justify-between group hover:border-[#C5A059]/30 transition-all text-left`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-[#C5A059]">
                    <Sparkles size={20} />
                  </div>
                  <span className="font-bold text-sm text-[#4A453E]">{service.nome}</span>
                </div>
                <div className="w-10 h-10 rounded-full border border-[#F5F1EA] flex items-center justify-center text-[#C5A059] group-hover:bg-[#C5A059] group-hover:text-white transition-all">
                  <ChevronRight size={18} />
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* 3. Differentials */}
        <section className="px-8 py-16 bg-[#F9F7F2]">
          <div className="grid grid-cols-1 gap-12">
            {differentials.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-[2rem] bg-white shadow-sm flex items-center justify-center text-[#C5A059]">
                  <item.icon size={28} strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm uppercase tracking-wider">{item.title}</h3>
                  <p className={`text-xs ${auraColors.textMuted}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Testimonials */}
        <section className="px-8 py-16 space-y-10">
          <h2 className="text-2xl font-['Playfair_Display'] font-bold text-center text-[#2D2A26]">O que dizem nossas clientes</h2>
          
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8">
            {testimonials.map((t, idx) => (
              <div key={idx} className="min-w-[280px] bg-white p-8 rounded-[2.5rem] border border-[#F5F1EA] space-y-4 shadow-sm">
                <div className="flex gap-1">
                  {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} fill="#C5A059" className="text-[#C5A059]" />)}
                </div>
                <p className="text-sm font-medium italic text-[#6B6359] leading-relaxed">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-full bg-[#FDFBF7] flex items-center justify-center text-[10px] font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Contact & Location */}
        <section className="px-8 py-16 bg-[#2D2A26] text-[#FDFBF7] space-y-10 rounded-t-[3rem]">
          <div className="space-y-6">
            <h2 className="text-3xl font-['Playfair_Display'] font-bold">Onde estamos</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-[#C5A059]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-1">Endereço</p>
                  <p className="text-sm font-medium leading-relaxed">{establishment.endereco || 'Consulte nosso endereço'}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Clock3 size={18} className="text-[#C5A059]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-1">Funcionamento</p>
                  <p className="text-sm font-medium leading-relaxed">{establishment.horario_funcionamento || 'Segunda a Sábado: 08h - 19h'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex gap-3 pt-4">
            <a 
              href={getWhatsAppUrl(establishment.telefone)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#C5A059] text-white font-black text-[10px] uppercase tracking-[0.2em]"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <a 
              href={getInstagramUrl(establishment.instagram)}
              target="_blank"
              rel="noreferrer"
              className="w-16 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10"
            >
              <Instagram size={20} />
            </a>
          </div>

          <p className="text-center text-[8px] font-black uppercase tracking-[0.5em] opacity-20">Aura by Musa Agenda</p>
        </section>

      </div>
      
      {/* Floating WhatsApp FAB - Custom for Aura */}
      <motion.a
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        href={getWhatsAppUrl(establishment.telefone)}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#25D366] text-white rounded-full shadow-2xl flex items-center justify-center z-50 lg:hidden"
      >
        <MessageCircle size={28} fill="currentColor" />
      </motion.a>

    </div>
  );
}
