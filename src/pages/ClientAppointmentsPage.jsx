import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, isAfter, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Clock3, 
  Sparkles, 
  X, 
  ChevronDown, 
  Info, 
  MessageCircle, 
  CalendarDays,
  CreditCard,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cancelAppointment, getMyAppointments } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';

export default function ClientAppointmentsPage() {
  const { user } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  const [establishment, setEstablishment] = useState(null);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

  const safeToDate = (dateObj) => {
    if (!dateObj) return new Date();
    if (dateObj.toDate) return dateObj.toDate();
    return new Date(dateObj);
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  const nextAppointment = useMemo(
    () =>
      myAppointments
        .filter((app) => app.status === 'ativo' && isAfter(safeToDate(app.start_time || app.data_hora), new Date()))
        .sort((a, b) => safeToDate(a.start_time || a.data_hora) - safeToDate(b.start_time || b.data_hora))[0],
    [myAppointments]
  );

  useEffect(() => {
    async function loadInitialData() {
      if (!slug) return;

      try {
        setLoading(true);
        const estData = await getEstablishmentBySlug(slug);

        if (!estData) {
          setEstablishment('not_found');
          return;
        }

        setEstablishment(estData);

        if (user) {
          const appointmentsData = await getMyAppointments(user.uid, estData.id);
          setMyAppointments(appointmentsData);
        } else {
          setMyAppointments([]);
        }
      } catch (error) {
        console.error('Erro ao carregar meus agendamentos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug, user?.uid]);

  async function reloadMyAppointments() {
    if (!user || !establishment?.id) return;
    const apps = await getMyAppointments(user.uid, establishment.id);
    setMyAppointments(apps);
  }

  async function handleConfirmCancel() {
    if (!appointmentToCancel) return;
    await cancelAppointment(appointmentToCancel.id);
    await reloadMyAppointments();
    setShowCancelModal(false);
    setAppointmentToCancel(null);
  }

  const handleWhatsApp = () => {
    if (!establishment?.telefone) return;
    const phone = establishment.telefone.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá! Gostaria de falar sobre meu agendamento na ${establishment.nome}.`);
    window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        <p className="font-medium text-pink-600 italic">Bellizy...</p>
      </div>
    );
  }

  if (establishment === 'not_found') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-pink-50 text-pink-400">
          <Sparkles size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Pagina nao encontrada</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-20 pt-4">
      {/* Cabeçalho Simplificado e Elegante */}
      <section className="rounded-[2rem] border-2 border-slate-950 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-pink-500">
              <CalendarIcon size={14} />
              <span>Sua Agenda Pessoal</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Gerencie seus horários na <span className="text-pink-600">{establishment?.nome}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-50 pt-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                <CalendarDays size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500">Cancelamentos até 24h antes</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock3 size={16} />
              </div>
              <span className="text-xs font-bold text-slate-500">Tolerância de 5 minutos</span>
            </div>
          </div>
        </div>
      </section>

      {user ? (
        <section className="space-y-4">
          <div className="space-y-3">
            {myAppointments.length > 0 ? (
              myAppointments.map((app) => {
                const appDate = safeToDate(app.start_time || app.data_hora);
                const isExpanded = expandedId === app.id;
                const isActive = app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado';
                const isCompleted = app.status === 'completed';
                const isCancelled = app.status === 'cancelled' || app.status === 'cancelado';
                const canCancel = isActive && isAfter(appDate, new Date());

                return (
                  <article
                    key={app.id}
                    className={`group overflow-hidden rounded-[2rem] border transition-all duration-300 ${
                      isCancelled
                        ? 'border-red-100 bg-red-50/30 opacity-60 grayscale'
                        : isCompleted
                        ? 'border-blue-100 bg-blue-50/30'
                        : isExpanded 
                          ? 'border-pink-200 bg-white shadow-xl shadow-slate-100'
                          : 'border-slate-100 bg-white hover:border-pink-100 hover:shadow-lg hover:shadow-slate-50'
                    }`}
                  >
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      className="flex cursor-pointer items-center justify-between p-5 sm:p-6"
                    >
                      <div className="flex-1">
                        <div className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
                          isActive ? 'bg-emerald-100 text-emerald-700' : 
                          isCompleted ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {isActive ? 'Confirmado' : 
                           isCompleted ? 'Finalizado' : 
                           'Cancelado'}
                        </div>
                        <h3 className="mt-3 text-base font-black text-slate-900 leading-tight">
                          {app.services?.length > 0 
                            ? app.services.map(s => s.nome || s.name).join(' + ')
                            : app.service_nome}
                        </h3>
                        <div className="mt-2 flex items-center gap-4 text-xs font-bold text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays size={14} className="text-pink-500" />
                            {format(appDate, "dd/MM 'às' HH:mm")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock3 size={14} className="text-pink-500" />
                            {app.total_duration || app.duration} min
                          </span>
                        </div>
                      </div>
                      
                      <div className={`ml-4 rounded-xl bg-slate-50 p-2 text-slate-400 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180 bg-pink-50 text-pink-600' : ''
                      }`}>
                        <ChevronDown size={20} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-50 bg-slate-50/30 p-6 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid gap-6 sm:grid-cols-2">
                          <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detalhes dos Serviços</p>
                            <div className="space-y-3">
                              {(app.services || [{ nome: app.service_nome, preco: app.preco, duracao: app.duration }]).map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-slate-600">{s.nome || s.name}</span>
                                  <span className="text-slate-900">{formatPrice(s.preco || s.price)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 border-t border-slate-200 pt-4 flex justify-between items-center">
                              <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Valor Total</span>
                              <span className="text-lg font-black text-pink-600">{formatPrice(app.total_price || app.preco)}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</p>
                            
                            {canCancel && (
                              <button
                                onClick={() => {
                                  setAppointmentToCancel(app);
                                  setShowCancelModal(true);
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border-2 border-slate-100 py-3 text-sm font-bold text-slate-600 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                              >
                                <X size={18} />
                                <span>Cancelar Agendamento</span>
                              </button>
                            )}

                            <button
                              onClick={handleWhatsApp}
                              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border-2 border-slate-100 py-3 text-sm font-bold text-slate-600 transition-all hover:border-pink-100 hover:bg-pink-50 hover:text-pink-600"
                            >
                              <MessageCircle size={18} />
                              <span>Falar com Estética</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50 px-5 py-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-200 mb-4">
                  <CalendarIcon size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Sua agenda está vazia</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Você ainda não realizou nenhum agendamento.
                </p>
                <button
                  onClick={() => navigate(`/${slug}/agendar`)}
                  className="mt-6 rounded-2xl bg-slate-950 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800"
                >
                  Agendar agora
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-[2.5rem] border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
          <p className="text-sm font-medium leading-relaxed text-slate-500 max-w-xs mx-auto">
            Entre na sua conta para gerenciar seus horários e acompanhar seu histórico.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-8 rounded-2xl bg-slate-950 px-10 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95"
          >
            Acessar minha conta
          </button>
        </section>
      )}

      {/* Modal de Cancelamento Profissional */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-red-50 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Deseja cancelar?</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Lembre-se que o horário será liberado para outras clientes.
              </p>
            </div>
            
            <div className="p-8 space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Resumo do Cancelamento</p>
                <p className="text-sm font-bold text-slate-800">{appointmentToCancel?.service_nome}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {format(safeToDate(appointmentToCancel?.start_time || appointmentToCancel?.data_hora), "dd/MM 'às' HH:mm")}
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    navigate(`/${slug}/agendar`);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 py-4 text-sm font-black text-white transition-all hover:bg-pink-700 shadow-lg shadow-pink-100"
                >
                  <RefreshCw size={18} />
                  <span>Trocar Agendamento (Remarcar)</span>
                </button>

                <button
                  onClick={handleConfirmCancel}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border-2 border-slate-100 py-4 text-sm font-bold text-red-500 transition-all hover:bg-red-50 hover:border-red-100"
                >
                  <X size={18} />
                  <span>Confirmar Cancelamento</span>
                </button>

                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-2 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
                >
                  Manter meu horário
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
