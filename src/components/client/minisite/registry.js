import LegacyLayout from './layouts/LegacyLayout';
import EleganceLayout from './layouts/EleganceLayout';
import ModernLayout from './layouts/ModernLayout';
import LuxuryLayout from './layouts/LuxuryLayout';
import PremiumBalanceLayout from './layouts/PremiumBalanceLayout';
import AuraLayout from './layouts/AuraLayout';
import SilkRoseLayout from './layouts/SilkRoseLayout';
import SimpleLayout from './layouts/SimpleLayout';

export const PALETTES = {
  rose_gold: {
    id: 'rose_gold',
    name: 'Rose Gold',
    primary: 'bg-pink-500',
    secondary: 'bg-rose-100',
    accent: 'text-pink-600',
    button: 'bg-pink-600 hover:bg-pink-700 text-white',
    border: 'border-pink-200',
    text: 'text-pink-900',
    gradient: 'from-pink-500 to-rose-600'
  },
  black_luxury: {
    id: 'black_luxury',
    name: 'Black Luxury',
    primary: 'bg-slate-900',
    secondary: 'bg-slate-100',
    accent: 'text-slate-900',
    button: 'bg-slate-900 hover:bg-black text-white',
    border: 'border-slate-200',
    text: 'text-slate-900',
    gradient: 'from-slate-800 to-black'
  },
  nude_clean: {
    id: 'nude_clean',
    name: 'Nude Clean',
    primary: 'bg-orange-100',
    secondary: 'bg-orange-50',
    accent: 'text-orange-800',
    button: 'bg-orange-800 hover:bg-orange-900 text-white',
    border: 'border-orange-200',
    text: 'text-orange-900',
    gradient: 'from-orange-200 to-orange-300'
  },
  pink_beauty: {
    id: 'pink_beauty',
    name: 'Pink Beauty',
    primary: 'bg-fuchsia-500',
    secondary: 'bg-fuchsia-100',
    accent: 'text-fuchsia-600',
    button: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white',
    border: 'border-fuchsia-200',
    text: 'text-fuchsia-900',
    gradient: 'from-fuchsia-500 to-pink-600'
  },
  gold_premium: {
    id: 'gold_premium',
    name: 'Gold Premium',
    primary: 'bg-amber-500',
    secondary: 'bg-amber-100',
    accent: 'text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    border: 'border-amber-200',
    text: 'text-amber-900',
    gradient: 'from-amber-400 to-amber-600'
  },
  emerald_zen: {
    id: 'emerald_zen',
    name: 'Emerald Zen',
    primary: 'bg-emerald-500',
    secondary: 'bg-emerald-50',
    accent: 'text-emerald-700',
    button: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    gradient: 'from-emerald-400 to-emerald-600'
  },
  lavender_calm: {
    id: 'lavender_calm',
    name: 'Lavender Calm',
    primary: 'bg-violet-400',
    secondary: 'bg-violet-50',
    accent: 'text-violet-600',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
    border: 'border-violet-200',
    text: 'text-violet-900',
    gradient: 'from-violet-300 to-violet-500'
  },
  sand_dune: {
    id: 'sand_dune',
    name: 'Sand Dune',
    primary: 'bg-stone-400',
    secondary: 'bg-stone-50',
    accent: 'text-stone-700',
    button: 'bg-stone-700 hover:bg-stone-800 text-white',
    border: 'border-stone-200',
    text: 'text-stone-900',
    gradient: 'from-stone-300 to-stone-500'
  },
  ocean_soft: {
    id: 'ocean_soft',
    name: 'Ocean Soft',
    primary: 'bg-sky-400',
    secondary: 'bg-sky-50',
    accent: 'text-sky-700',
    button: 'bg-sky-700 hover:bg-sky-800 text-white',
    border: 'border-sky-200',
    text: 'text-sky-900',
    gradient: 'from-sky-300 to-sky-500'
  }
};

export const LAYOUTS = {
  simple: {
    id: 'simple',
    name: 'Padrão (Simples Profissional)',
    component: SimpleLayout,
    description: 'Layout padrão: simples, profissional e direto ao ponto.',
    plan: 'bronze'
  },
  legacy: {
    id: 'legacy',
    name: 'Clássico (Legacy)',
    component: LegacyLayout,
    description: 'O layout clássico que você já conhece.',
    plan: 'bronze'
  },
  elegance: {
    id: 'elegance',
    name: 'Elegance',
    component: EleganceLayout,
    description: 'Design sofisticado e minimalista.',
    plan: 'silver'
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    component: ModernLayout,
    description: 'Visual contemporâneo e dinâmico.',
    plan: 'silver'
  },
  aura: {
    id: 'aura',
    name: 'Aura High-End',
    component: AuraLayout,
    description: 'Design One Page sofisticado para clínicas de alto padrão.',
    plan: 'silver'
  },
  luxury: {
    id: 'luxury',
    name: 'Luxury',
    component: LuxuryLayout,
    description: 'O ápice do luxo e exclusividade.',
    plan: 'gold'
  },
  premium_balance: {
    id: 'premium_balance',
    name: 'Premium Balance',
    component: PremiumBalanceLayout,
    description: 'O equilíbrio perfeito entre o moderno e o luxo.',
    plan: 'gold'
  },
  silk_rose: {
    id: 'silk_rose',
    name: 'Silk Rose (Ultra Feminino)',
    component: SilkRoseLayout,
    description: 'Design delicado com texturas de seda e estética romântica.',
    plan: 'gold'
  }
};

export const DEFAULT_SETTINGS = {
  layoutId: 'simple',
  paletteId: 'rose_gold',
  bannerUrl: '',
  bioText: 'Realçando sua beleza natural ✨',
  showDescription: true
};
