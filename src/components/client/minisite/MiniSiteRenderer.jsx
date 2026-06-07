import React from 'react';
import { LAYOUTS, PALETTES, DEFAULT_SETTINGS } from './registry';

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

  // Cria uma versão modificada do establishment para os layouts
  const effectiveEstablishment = {
    ...establishment,
    nome: activeIdentity.nome,
    logo_url: activeIdentity.foto,
    photoURL: activeIdentity.foto
  };

  return (
    <LayoutComponent
      establishment={effectiveEstablishment}
      onBookClick={onBookClick}
      settings={activeSettings}
      palette={palette}
      services={services || []}
    />
  );
}
