import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sparkles, ArrowRight, Store, Star, Trash2, Bell } from 'lucide-react';
import Login from './pages/Login';

/* -------------- LAZY LOADING (A4 — Code Splitting por Rota) --------------
   - Login = EAGER (tela de entrada sempre necessária).
   - Todas as outras = LAZY (baixadas apenas quando o usuário navega).
   - O AdminDashboard (7000 linhas, ~60% do bundle) é o chunk com maior impacto.
----------------------------------------------------------------------------- */
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'));
const ClientAppointmentsPage = lazy(() => import('./pages/ClientAppointmentsPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingSchedulePage = lazy(() => import('./pages/BookingSchedulePage'));
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const ClientAnamnesisPage = lazy(() => import('./pages/ClientAnamnesisPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LgpdConsent from './components/LgpdConsent';
import { db, updateUserDoc } from './services/firebase';
import { deleteField, doc, onSnapshot } from 'firebase/firestore';
import { getEstablishmentBySlug, sanitizeSlug } from './services/establishmentService';
import { requestNotificationPermission, onMessageListener } from './services/notificationService';

/**
 * Fallback visual padrão usado pelo <Suspense> enquanto baixa o chunk da rota.
 * Alinhado ao tema rosa do Musa (evita flicker branco/estranho na navegação).
 */
function RouteSuspenseFallback() {
  return (
    <div className="min-h-[85vh] w-full flex items-center justify-center bg-gradient-to-b from-pink-50/40 via-white to-white">
      <div className="flex flex-col items-center gap-4 text-pink-600">
        <div className="h-14 w-14 rounded-3xl bg-pink-100 flex items-center justify-center shadow-sm border border-pink-200">
          <Sparkles size={26} className="animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-500">
            Musa Agenda
          </span>
          <span className="text-sm font-bold text-slate-600">
            Carregando…
          </span>
        </div>
        <div className="w-56 h-1.5 overflow-hidden rounded-full bg-pink-100">
          <div className="h-full w-1/2 bg-pink-500 rounded-full animate-[shimmer_1.1s_ease-in-out_infinite]"
               style={{
                 background: 'linear-gradient(90deg, #ec4899, #f472b6, #ec4899)',
                 backgroundSize: '200% 100%',
                 animation: 'loadingShimmer 1.1s ease-in-out infinite',
               }} />
        </div>
        <style>{`
          @keyframes loadingShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

function NotificationHandler() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    // Verifica se já temos permissão ou se devemos pedir
    if (Notification.permission === 'default') {
      // Pequeno atraso para não assustar o usuário assim que logar
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    if (Notification.permission === 'granted') {
      requestNotificationPermission(user.uid);
    }

    // Listener para mensagens em primeiro plano
    const unsubscribe = onMessageListener().then(payload => {
      // Você pode mostrar um toast customizado aqui se quiser
      console.log("Notificação recebida:", payload);
    });

  }, [user?.uid]);

  const handleEnable = async () => {
    const token = await requestNotificationPermission(user.uid);
    if (token) {
      setShowBanner(false);
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-pink-100 p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
          <Bell className="animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900">Ativar Notificações?</p>
          <p className="text-xs font-medium text-slate-500">Receba lembretes de agendamentos e promoções.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBanner(false)}
            className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Agora não
          </button>
          <button 
            onClick={handleEnable}
            className="bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-pink-200 active:scale-95 transition-transform"
          >
            Ativar
          </button>
        </div>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  if (user?.tipo === 'admin' || user?.tipo === 'staff') {
    return <Navigate to="/admin" replace />;
  }

  return <ClientHub />;
}

function ClientHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState([]);
  const [input, setInput] = useState('');
  const [lastSlug, setLastSlug] = useState('');
  const [busyId, setBusyId] = useState('');
  const [checking, setChecking] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data() || {};
      const map = data.saved_establishments || {};
      setLastSlug(data.last_establishment_slug || '');
      const list = Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => {
          const favDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
          if (favDiff !== 0) return favDiff;
          return (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0);
        });
      setSaved(list);
    });
    return () => unsub();
  }, [user?.uid]);

  const goToSlug = async (raw) => {
    const value = (raw || '').trim();
    if (!value) return;
    setInputError('');

    let candidate = value;
    try {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        const url = new URL(value);
        candidate = url.pathname.replace(/^\/+/, '').split('/')[0] || '';
      }
    } catch {
    }

    const slug = sanitizeSlug(candidate);
    if (!slug) {
      setInputError('Cole um link válido para continuar.');
      return;
    }

    setChecking(true);
    try {
      const est = await getEstablishmentBySlug(slug);
      if (!est) {
        setInputError('Link inválido. Verifique com a profissional.');
        return;
      }
      navigate(`/${slug}`);
    } finally {
      setChecking(false);
    }
  };

  const toggleFavorite = async (est) => {
    if (!user?.uid || !est?.id) return;
    setBusyId(est.id);
    try {
      await updateUserDoc(user.uid, {
        [`saved_establishments.${est.id}.favorite`]: !Boolean(est.favorite)
      });
    } finally {
      setBusyId('');
    }
  };

  const removeSaved = async (est) => {
    if (!user?.uid || !est?.id) return;
    const ok = window.confirm(`Remover "${est.nome || est.slug}" das suas estéticas salvas?`);
    if (!ok) return;

    setBusyId(est.id);
    try {
      const updates = {
        [`saved_establishments.${est.id}`]: deleteField()
      };
      if ((lastSlug || '') === (est.slug || '')) {
        updates.last_establishment_slug = deleteField();
      }
      await updateUserDoc(user.uid, updates);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-14 pt-6 sm:pt-10">
      <div className="rounded-[2.5rem] border-2 border-slate-950 bg-white p-6 sm:p-8 shadow-2xl shadow-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-600">Área do Cliente</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Minhas Estéticas</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Cole o link que você recebeu para agendar. Você pode salvar várias estéticas aqui.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
            <Sparkles size={22} />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Adicionar estética</label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void goToSlug(input);
              }}
              placeholder="Ex: linda-mulher ou cole o link completo"
              className="flex-1 rounded-2xl bg-pink-50/50 border-2 border-transparent px-4 py-4 font-bold text-slate-800 outline-none focus:border-pink-300"
            />
            <button
              type="button"
              disabled={checking || !input.trim()}
              onClick={() => void goToSlug(input)}
              className={`rounded-2xl px-5 py-4 text-white font-black uppercase tracking-widest text-xs transition-all ${
                checking || !input.trim()
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-950 hover:bg-slate-800 active:scale-95'
              }`}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          {inputError && (
            <p className="ml-2 text-xs font-bold text-rose-600">{inputError}</p>
          )}
        </div>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm border border-slate-100">
            <Store size={22} />
          </div>
          <p className="text-sm font-bold text-slate-500">
            Nenhuma estética salva ainda. Cole um link acima para começar.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {saved.map((est) => (
            <div
              key={est.id}
              className="w-full rounded-[2rem] border-2 border-slate-950 bg-white p-5 text-left shadow-xl shadow-slate-200/40"
            >
              <button
                type="button"
                onClick={() => navigate(`/${est.slug}`)}
                className="w-full text-left hover:bg-pink-50/30 transition-colors rounded-[1.5rem] p-2 -m-2"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-100 bg-white flex items-center justify-center">
                    {est.logo_url ? (
                      <img src={est.logo_url} alt={est.nome || est.slug} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-slate-800">{(est.nome || est.slug || 'E').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{est.nome || 'Estética'}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{window.location.host}/{est.slug}</p>
                  </div>
                </div>
              </button>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(est)}
                  disabled={busyId === est.id}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors active:scale-[0.99] ${
                    est.favorite
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:text-pink-600'
                  }`}
                >
                  <Star size={16} fill={est.favorite ? 'currentColor' : 'none'} />
                  {est.favorite ? 'Favorita' : 'Favoritar'}
                </button>
                <button
                  type="button"
                  onClick={() => removeSaved(est)}
                  disabled={busyId === est.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-colors hover:border-rose-300 active:scale-[0.99]"
                >
                  <Trash2 size={16} />
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <>
      <LgpdConsent />
      <AuthProvider>
      <NotificationHandler />
      <Router>
        <Suspense fallback={<RouteSuspenseFallback />}>
          <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute allowedRoles={['any']}>
              <Layout>
                <RootRedirect />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/client" element={
            <ProtectedRoute allowedRoles={['cliente', 'client', 'any']}>
              <Layout>
                <ClientHub />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/:slug/agendar" element={
            <Layout>
              <BookingPage />
            </Layout>
          } />

          <Route path="/:slug/agendar/horarios/:serviceId" element={
            <Layout>
              <BookingSchedulePage />
            </Layout>
          } />

          <Route path="/:slug/agendar/confirmacao" element={
            <ProtectedRoute allowedRoles={['any']}>
              <Layout>
                <BookingConfirmationPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/:slug/agenda" element={
            <ProtectedRoute allowedRoles={['any']}>
              <Layout>
                <ClientAppointmentsPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/:slug/anamnese/:appointmentId" element={
            <ProtectedRoute allowedRoles={['any']}>
              <Layout>
                <ClientAnamnesisPage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/:slug/perfil" element={
            <ProtectedRoute allowedRoles={['any']}>
              <Layout>
                <ClientProfilePage />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} unauthorizedTo="/client">
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          } />

          {/* Rota multi-tenant dinâmica baseada no slug (Cliente logado ou não, pode ver dashboard público da clínica) */}
          <Route path="/:slug" element={
            <Layout>
              <ClientDashboard />
            </Layout>
          } />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
    </>
  );
}

export default App;
