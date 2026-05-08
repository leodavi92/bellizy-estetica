import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sparkles, ArrowRight, Store, Star, Trash2 } from 'lucide-react';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import ClientProfilePage from './pages/ClientProfilePage';
import ClientAppointmentsPage from './pages/ClientAppointmentsPage';
import BookingPage from './pages/BookingPage';
import BookingSchedulePage from './pages/BookingSchedulePage';
import BookingConfirmationPage from './pages/BookingConfirmationPage';
import AdminDashboard from './pages/AdminDashboard';
import Layout from './components/Layout';
import { db } from './services/firebase';
import { deleteField, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getEstablishmentBySlug, sanitizeSlug } from './services/establishmentService';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.tipo !== 'admin') return <Navigate to="/" />;

  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user?.tipo === 'admin') {
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
      await updateDoc(doc(db, 'users', user.uid), {
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
      await updateDoc(doc(db, 'users', user.uid), updates);
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

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user || user.tipo !== 'admin') return <Navigate to="/login" />;

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Layout>
                <RootRedirect />
              </Layout>
            </PrivateRoute>
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
            <PrivateRoute>
              <Layout>
                <BookingConfirmationPage />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/:slug/agenda" element={
            <Layout>
              <ClientAppointmentsPage />
            </Layout>
          } />

          <Route path="/:slug/perfil" element={
            <Layout>
              <ClientProfilePage />
            </Layout>
          } />

          <Route path="/admin" element={
            <AdminRoute>
              <Layout>
                <AdminDashboard />
              </Layout>
            </AdminRoute>
          } />

          {/* Rota multi-tenant dinâmica baseada no slug */}
          <Route path="/:slug" element={
            <Layout>
              <ClientDashboard />
            </Layout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
