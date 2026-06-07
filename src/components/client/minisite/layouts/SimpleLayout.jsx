import React from 'react';
import { 
  Phone, 
  Instagram, 
  MapPin, 
  Clock3, 
  ChevronRight,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getWhatsAppUrl, getInstagramUrl } from '../../../../services/establishmentService';

export default function SimpleLayout({
  establishment,
  onBookClick,
  settings,
  palette,
  services: realServices
}) {
  const description = settings?.bioText || 'Atendimento profissional de excelência.';
  
  const displayServices = realServices && realServices.length > 0 ? realServices : [];

  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  return (
    <div className="relative h-full w-full flex flex-col bg-white rounded-[2.5rem] overflow-hidden font-sans text-slate-900">
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        
        {/* 1. Header Area com Cor Dinâmica e Degradê Suave */}
        <section className="relative pt-24 pb-12 px-8 text-center space-y-6 overflow-hidden bg-white">
          {/* Fundo Colorido com Transparência e Degradê Longo */}
          <div className={`absolute inset-0 opacity-[0.22] ${palette.primary} ${palette.gradient && `bg-gradient-to-br ${palette.gradient}`} transition-colors duration-500`} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white" />
          
          {/* Foto de Perfil em Quadrado Arredondado */}
          <div className="flex justify-center relative">
            <div className="w-32 h-32 bg-white rounded-3xl p-1 shadow-xl relative z-10 overflow-hidden border border-slate-50">
              {establishment.photoURL || establishment.logo_url ? (
                <img 
                  src={establishment.photoURL || establishment.logo_url} 
                  alt={establishment.nome} 
                  className="w-full h-full object-cover rounded-2xl" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                  <User size={48} />
                </div>
              )}
            </div>
          </div>

          <div className={`space-y-1 relative z-10 ${settings?.showDescription !== false ? '' : 'mb-6'}`}>
            <h1 className={`text-3xl font-black tracking-tight ${palette.accent}`}>{establishment.nome}</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Especialista Certificada</p>
          </div>
          
          {settings?.showDescription !== false && (
            <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-100 relative z-10">
              <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                "{description}"
              </p>
            </div>
          )}

          <div className="space-y-3 relative z-10">
            {/* Ações Rápidas em Quadradinhos */}
            <div className="grid grid-cols-3 gap-2">
              <a 
                href={getWhatsAppUrl(establishment.telefone)}
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Phone size={18} className={palette.accent} />
                <span className="text-[8px] font-black uppercase text-slate-400">Zap</span>
              </a>
              <a 
                href={getInstagramUrl(establishment.instagram)}
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Instagram size={18} className="text-pink-500" />
                <span className="text-[8px] font-black uppercase text-slate-400">Insta</span>
              </a>
              <button 
                onClick={() => {
                  const addr = establishment.endereco || '';
                  if(addr) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                }}
                className="aspect-square bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <MapPin size={18} className="text-slate-400" />
                <span className="text-[8px] font-black uppercase text-slate-400">Local</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. Serviços em Destaque - Só aparece se houver serviços */}
        {displayServices.length > 0 && (
          <section className="px-8 pb-12 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Serviços em Destaque</h3>
              <div className={`h-1 w-12 rounded-full ${palette.primary}`} />
            </div>

            <div className="grid gap-4">
              {displayServices.map((service, idx) => (
                <motion.div
                  key={service.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => onBookClick(service.id)}
                  className="group cursor-pointer flex items-center justify-between p-5 rounded-[1.75rem] bg-slate-50 border border-slate-100 hover:border-pink-200 hover:bg-white transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-800 group-hover:text-pink-600 transition-colors">
                      {service.nome}
                    </span>
                    <span className="text-sm font-black text-pink-500/80">
                      {formatPrice(service.preco)}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-100 text-slate-400 group-hover:${palette.primary} group-hover:text-white transition-all`}>
                    <ChevronRight size={16} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Rodapé de Contato */}
        <section className="px-8 pb-12 pt-4 space-y-8">
          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-3 text-slate-400">
              <MapPin size={16} />
              <span className="text-[10px] font-bold uppercase tracking-tight">{establishment.endereco || 'Endereço do Studio'}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <Clock3 size={16} />
              <span className="text-[10px] font-bold uppercase tracking-tight">{establishment.horario_funcionamento || 'Consulte nossos horários'}</span>
            </div>
          </div>

          <p className="text-center text-[8px] font-black uppercase tracking-[0.4em] text-slate-200">Simple Professional Layout</p>
        </section>

      </div>
    </div>
  );
}
