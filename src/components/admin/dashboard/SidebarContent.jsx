import React from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Clock,
  Plus,
  Settings,
  LogOut,
  Users,
  Sparkles,
  Instagram,
  CreditCard,
  Store,
  Lock,
  ClipboardList,
  Bell
} from 'lucide-react';

const SidebarContent = ({ view, setView, logout, establishment, profileInfo, menuItems: propMenuItems, userRole }) => {
  const userPlan = establishment?.plan || establishment?.subscription?.plan || 'bronze';
  const isSubscriptionView = view === 'assinatura' || view === 'planos_assinatura';

  const defaultMenuItems = [
    { id: 'overview', label: 'Início', icon: TrendingUp },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'comissoes', label: 'Comissões', icon: DollarSign, hideForAdmin: true },
    { id: 'clientes', label: 'Clientes', icon: Users, hideForStaff: true },
    { id: 'servicos', label: 'Serviços', icon: Plus, hideForStaff: true },
    { id: 'horarios', label: 'Horários', icon: Clock, hideForStaff: true },
    { id: 'lembretes', label: 'Lembretes', icon: Bell },
    { id: 'minisite', label: 'Site', icon: Store, hideForStaff: true },
    { id: 'anamnese', label: 'Fichas', icon: ClipboardList },
    { id: 'equipe', label: 'Equipe', icon: Users, restricted: false, hideForStaff: true },
    { id: 'financas', label: 'Finanças', icon: DollarSign, restricted: false, hideForStaff: true },
    { id: 'config', label: 'Configurações', icon: Settings },
    { id: 'assinatura', label: 'Assinatura', icon: CreditCard, hideForStaff: true }
  ];

  const menuItems = (propMenuItems || defaultMenuItems).filter(item => {
    if (userRole === 'staff' && item.hideForStaff) return false;
    if (userRole === 'admin' && item.hideForAdmin) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-pink-100">
      {/* Topo do Menu: Logo e Infos */}
      <div className="p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-100 shrink-0 overflow-hidden">
            {profileInfo?.photoURL || profileInfo?.logo_url ? (
              <img src={profileInfo.photoURL || profileInfo.logo_url} alt={profileInfo.nome} className="w-full h-full object-cover" />
            ) : (
              <Sparkles size={28} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-pink-600 to-rose-500 bg-clip-text text-transparent" style={{ textShadow: '0 0 1px rgba(219, 39, 119, 0.2)' }}>
              Musa Agenda
            </h1>
            {profileInfo?.nome && (
              <p className="text-xs text-pink-500 font-bold truncate">
                {profileInfo.nome}
              </p>
            )}
          </div>
        </div>
        <div className="h-px bg-gray-100 w-full" />
      </div>

      {/* Itens de Navegação */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
        {menuItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold transition-all ${
              (item.id === 'assinatura' ? isSubscriptionView : view === item.id)
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-100 scale-[1.02]' 
                : 'text-gray-500 hover:bg-pink-50 hover:text-pink-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} />
              <span className="text-sm">{item.label}</span>
            </div>
            {item.restricted && (
              <Lock size={14} className={(item.id === 'assinatura' ? isSubscriptionView : view === item.id) ? 'text-white/70' : 'text-gray-300'} />
            )}
          </button>
        ))}
      </nav>

      {/* Rodapé: Sair */}
      <div className="p-4 border-t border-gray-100 mt-auto">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut size={20} />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default SidebarContent;
