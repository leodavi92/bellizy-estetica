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

  // Lógica de Identidade Ativa (Marca Pessoal vs Corporativa)
  const isPersonal = activeSettings.identityMode === 'personal';
  
  // Prioriza professionalName se estiver no modo pessoal, senão usa o nome do estabelecimento
  const activeName = isPersonal 
    ? (establishment.professionalName || establishment.nome || '') 
    : (establishment.nome || '');

  // Prioriza photoURL se estiver no modo pessoal, senão usa logo_url
  // Adiciona fallback mútuo para garantir que alguma imagem apareça se disponível
  const activeFoto = isPersonal
    ? (establishment.photoURL || establishment.logo_url || '')
    : (establishment.logo_url || establishment.photoURL || '');

  const activeIdentity = {
    nome: activeName,
    foto: activeFoto
  };

  // Cria uma versão modificada do establishment para os layouts
  const effectiveEstablishment = {
    ...establishment,
    nome: activeIdentity.nome,
    // Garante que o layout use a foto correta independente de qual campo ele chame
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
