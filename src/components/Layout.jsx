import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut, User, Calendar, Home, Phone, MessageCircleMore } from 'lucide-react';
import InstallPWA from './InstallPWA';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getWhatsAppUrl } from '../services/establishmentService';

export default function Layout({ children }) {
  const { user, setUser, establishment, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clientSetupOpen, setClientSetupOpen] = useState(false);
  const [clientNome, setClientNome] = useState('');
  const [clientTelefone, setClientTelefone] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState('');

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentSlug =
    pathSegments[0] && pathSegments[0] !== 'login'
      ? pathSegments[0]
      : localStorage.getItem('last_estetica_slug');

  const isHomeRoute = location.pathname === `/${currentSlug}`;
  const isAppointmentsRoute = location.pathname.includes('/agenda');
  const isProfileRoute = location.pathname.includes('/perfil');
  const isBookingRoute = location.pathname.includes('/agendar');

  const handleHomeNavigation = () => {
    if (!currentSlug) return;
    navigate(`/${currentSlug}`);
  };

  const handleAgendaNavigation = () => {
    if (!currentSlug) return;
    navigate(`/${currentSlug}/agenda`);
  };

  const handleProfileNavigation = () => {
    if (!currentSlug) return;
    navigate(`/${currentSlug}/perfil`);
  };

  const canSwitchEstablishment =
    user?.tipo === 'cliente' &&
    location.pathname !== '/' &&
    location.pathname !== '/login' &&
    location.pathname !== '/admin';

  useEffect(() => {
    const needsSetup =
      user?.tipo === 'cliente' &&
      !user?.isOffline &&
      (!String(user?.nome || '').trim() || !String(user?.telefone || '').trim());

    setClientSetupOpen(Boolean(needsSetup));
    if (needsSetup) {
      setClientNome(String(user?.nome || '').trim());
      setClientTelefone(String(user?.telefone || '').trim());
      setClientError('');
    }
  }, [user?.tipo, user?.nome, user?.telefone, user?.isOffline]);

  const handleSaveClientSetup = async () => {
    if (!user?.uid) return;
    const nome = clientNome.trim();
    const telefone = clientTelefone.trim();
    if (!nome || !telefone) {
      setClientError('Preencha seu nome e seu WhatsApp para continuar.');
      return;
    }

    setClientSaving(true);
    setClientError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { nome, telefone });
      if (setUser) setUser((prev) => ({ ...prev, nome, telefone }));
      setClientSetupOpen(false);
    } catch (e) {
      setClientError('Não foi possível salvar agora. Verifique sua conexão e tente novamente.');
    } finally {
      setClientSaving(false);
    }
  };

  const isAdminRoute = location.pathname === '/admin';

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-gray-50/50 font-sans">
        <main className="flex-1 w-full">
          {children}
        </main>
        <InstallPWA />
      </div>
    );
  }

  const isClientView =
    location.pathname !== '/' &&
    location.pathname !== '/login' &&
    !location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b-2 border-pink-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button 
            onClick={handleHomeNavigation}
            className="flex items-center gap-3 group transition-all"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-pink-200 rotate-3 group-hover:rotate-0 transition-transform">
              P
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black text-gray-800 leading-none tracking-tight">Bellizy</h1>
              <span className="text-[10px] text-pink-600 font-bold uppercase tracking-widest">Estética & Bem-estar</span>
            </div>
          </button>
          
          <div className="flex items-center gap-4">
            {/* Desktop Navigation - Apenas Logados */}
            {isClientView && !isBookingRoute && user && (
              <nav className="hidden sm:flex items-center gap-1 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                <button
                  onClick={handleHomeNavigation}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isHomeRoute ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Início
                </button>
                <button
                  onClick={handleAgendaNavigation}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isAppointmentsRoute ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Agenda
                </button>
                <button
                  onClick={handleProfileNavigation}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    isProfileRoute ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Perfil
                </button>
              </nav>
            )}

            <div className="flex items-center gap-2">
              {canSwitchEstablishment && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all border border-gray-100"
                  title="Trocar estética"
                >
                  <ArrowLeftRight size={18} />
                </button>
              )}

              {user ? (
                <button 
                  onClick={logout}
                  className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all border border-gray-100"
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-28 md:pb-10">
        {children}
      </main>

      <InstallPWA />

      {/* Botão WhatsApp Flutuante */}
      {isClientView && establishment?.telefone && (
        <a
          href={getWhatsAppUrl(establishment.telefone)}
          target="_blank"
          rel="noopener noreferrer"
          className={`fixed right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl transition-all hover:scale-110 active:scale-95 ${
            isBookingRoute ? 'bottom-24' : 'bottom-28 sm:bottom-10'
          }`}
          title="Conversar no WhatsApp"
        >
          <MessageCircleMore size={28} />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 animate-ping rounded-full bg-emerald-400" />
          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
        </a>
      )}

      {/* Navegação Mobile - Visível apenas para Logados */}
      {isClientView && !isBookingRoute && user && (
        <nav className="fixed bottom-6 left-6 right-6 bg-white/90 backdrop-blur-lg border border-pink-100 px-6 py-4 rounded-[2.5rem] shadow-2xl z-40 sm:hidden">
          <div className="flex justify-around items-center">
            <button
              type="button"
              onClick={handleHomeNavigation}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
                isHomeRoute ? 'text-pink-600' : 'text-gray-300'
              }`}
            >
              <Home size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Início</span>
            </button>

            <button
              type="button"
              onClick={handleAgendaNavigation}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
                isAppointmentsRoute ? 'text-pink-600' : 'text-gray-300'
              }`}
            >
              <Calendar size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Agenda</span>
            </button>

            <button
              type="button"
              onClick={handleProfileNavigation}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${
                isProfileRoute ? 'text-pink-600' : 'text-gray-300'
              }`}
            >
              <User size={22} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Perfil</span>
            </button>
          </div>
        </nav>
      )}

      {clientSetupOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2.5rem] border-2 border-slate-950 bg-white p-6 shadow-2xl shadow-slate-900/20 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-600">Finalizar cadastro</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Só falta o seu nome e WhatsApp</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Para continuar e garantir seu agendamento, complete seus dados.
            </p>

            <div className="mt-6 space-y-3">
              <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Seu nome</label>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50/60 px-4 py-3">
                <User size={18} className="text-slate-400" />
                <input
                  value={clientNome}
                  onChange={(e) => setClientNome(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                  placeholder="Seu nome"
                />
              </div>

              <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Seu WhatsApp</label>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50/60 px-4 py-3">
                <Phone size={18} className="text-slate-400" />
                <input
                  value={clientTelefone}
                  onChange={(e) => setClientTelefone(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                  placeholder="(11) 99999-9999"
                />
              </div>

              {clientError && <p className="ml-2 text-xs font-bold text-rose-600">{clientError}</p>}
            </div>

            <button
              type="button"
              onClick={handleSaveClientSetup}
              disabled={clientSaving}
              className="mt-6 w-full rounded-2xl bg-slate-950 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {clientSaving ? 'Salvando...' : 'Continuar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
