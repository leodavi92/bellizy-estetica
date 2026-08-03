import React from 'react';
import { LAYOUTS, PALETTES, DEFAULT_SETTINGS } from './registry';
import { LgpdFooterLinks } from '../../LgpdConsent';
import { usePageSeo } from '../../../utils/seo';

export default function MiniSiteRenderer({ 
  establishment, 
  onBookClick, 
  settings,
  services
}) {
  // Mescla as configurações atuais com os padrões para evitar erros
  const activeSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  const layoutConfig = LAYOUTS[activeSettings.layoutId] || LAYOUTS.legacy;
  const palette = PALETTES[activeSettings.paletteId] || PALETTES.rose_gold;
  
  const LayoutComponent = layoutConfig.component || LAYOUTS.legacy.component;

  const activeIdentity = {
    nome: establishment.nome || establishment.name || '',
    foto: establishment.logo_url || establishment.photoURL || ''
  };

  // SEO dinâmico por estabelecimento (preview WhatsApp/Instagram/Google)
  const servicesSample = (services || []).slice(0, 4).map(s => s.nome).filter(Boolean);
  const seoDescription = (() => {
    const base = `Agende seu horário online na ${activeIdentity.nome || 'estética'}`;
    const local = establishment.endereco?.cidade || establishment.cidade ? ` em ${establishment.endereco?.cidade || establishment.cidade}` : '';
    const tail = servicesSample.length > 0
      ? ` • Serviços: ${servicesSample.join(', ')}.`
      : ' • Atendimento profissional e horários flexíveis.';
    return `${base}${local}${tail}`;
  })();
  const seoTitle = `${activeIdentity.nome || 'Agendamento Online'} • Agende Horário`;
  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    image: activeIdentity.foto || undefined,
    type: 'website'
  });

  // Cria uma versão modificada do establishment para os layouts
  const effectiveEstablishment = {
    ...establishment,
    nome: activeIdentity.nome,
    logo_url: activeIdentity.foto,
    photoURL: activeIdentity.foto
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <LayoutComponent
          establishment={effectiveEstablishment}
          onBookClick={onBookClick}
          settings={activeSettings}
          palette={palette}
          services={services || []}
        />
      </div>

      {/* Rodapé LGPD — visível em TODOS os temas do minisite público */}
      <footer className="w-full border-t border-slate-100 bg-white/60 backdrop-blur py-6 px-4">
        <div className="mx-auto max-w-4xl space-y-3 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            © {new Date().getFullYear()} Musa Agenda · Agendamento Online
          </div>
          <LgpdFooterLinks />
          <div className="text-[11px] font-medium text-slate-400 leading-relaxed">
            Este site segue a Lei Geral de Proteção de Dados (Lei 13.709/2018).
            <br />
            Seus dados são tratados de forma segura e confidencial.
          </div>
        </div>
      </footer>
    </div>
  );
}
