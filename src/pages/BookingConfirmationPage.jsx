import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  Calendar, 
  Clock3, 
  CreditCard, 
  ShieldCheck, 
  Info, 
  ArrowLeft, 
  MessageCircle, 
  PlusCircle,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createAppointment, getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';

export default function BookingConfirmationPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dados vindos da navegação anterior
  const { 
    selectedServicesIds = '', 
    selectedDateStr = '', 
    totalDuration = 0, 
    totalPrice = 0 
  } = location.state || {};

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPolicyAccepted, setIsPolicyAccepted] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);

  const selectedDate = useMemo(() => selectedDateStr ? new Date(selectedDateStr) : null, [selectedDateStr]);

  const selectedServices = useMemo(() => {
    if (!selectedServicesIds || services.length === 0) return [];
    const ids = selectedServicesIds.split(',');
    return services.filter(s => ids.includes(s.id));
  }, [services, selectedServicesIds]);

  useEffect(() => {
    async function loadData() {
      if (!slug || !selectedDate) {
        navigate(`/${slug}/agendar`);
        return;
      }

      try {
        setLoading(true);
        const estData = await getEstablishmentBySlug(slug);
        if (!estData) {
          navigate('/');
          return;
        }
        setEstablishment(estData);

        const servicesData = await getServices(estData.id);
        setServices(servicesData);
      } catch (error) {
        console.error('Erro ao carregar confirmação:', error);
      } finally {
        // CORREÇÃO: Garantir que o loading só seja removido aqui no início
        setLoading(false);
      }
    }
    loadData();
  }, [slug, selectedDate, navigate]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      // Pequeno delay para passar a sensação de processamento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const appointmentData = {
        establishment_id: establishment.id,
        establishment_name: establishment.nome,
        user_id: user.uid,
        user_nome: user.nome,
        user_avatar: user.photoURL || user.avatar_url || '',
        user_phone: user.telefone || user.phone || '',
        services: selectedServices.map(s => ({
          id: s.id,
          nome: s.nome,
          duracao: s.duracao,
          preco: s.preco
        })),
        data_hora: selectedDate,
        total_duration: totalDuration,
        total_price: totalPrice,
        service_id: selectedServices[0].id,
        service_nome: selectedServices.map(s => s.nome).join(', '),
        duration: totalDuration,
        preco: totalPrice
      };

      const appointmentId = await createAppointment(appointmentData);
      
      setConfirmedAppointment({
        ...appointmentData,
        id: appointmentId,
        end_time: addMinutes(selectedDate, totalDuration)
      });
      setBookingSuccess(true);
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error);
      alert('Erro ao confirmar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!establishment?.telefone) return;
    const phone = establishment.telefone.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá! Gostaria de falar sobre meu agendamento na ${establishment.nome}.`);
    window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  if (loading && !bookingSuccess) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-20 text-center">
        <div className="relative mb-8">
          <div className="h-20 w-20 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="text-pink-600 animate-pulse" size={24} />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estamos realizando seu agendamento...</h2>
        <p className="mt-2 text-slate-500 font-medium">Por favor, aguarde um instante enquanto reservamos seu horário.</p>
        
        {/* Barra de progresso visual simulada */}
        <div className="mt-8 w-full max-w-xs bg-pink-50 h-2 rounded-full overflow-hidden">
          <div className="bg-pink-600 h-full animate-progress-bar rounded-full" />
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes progress-bar {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          .animate-progress-bar {
            animation: progress-bar 1.5s ease-in-out forwards;
          }
        `}} />
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 animate-in fade-in zoom-in duration-500">
        <div className="rounded-[3rem] bg-white p-8 text-center shadow-2xl shadow-slate-200">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={56} />
          </div>
          
          <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-900">
            Agendamento Confirmado!
          </h1>
          <p className="mt-3 text-slate-500">
            Tudo certo! Seu horário foi reservado com sucesso na {establishment?.nome}.
          </p>

          <div className="mt-10 rounded-3xl border border-slate-100 bg-slate-50/50 p-6 text-left">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-pink-600">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Data</p>
                  <p className="font-bold text-slate-900">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-pink-600">
                  <Clock3 size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Horário</p>
                  <p className="font-bold text-slate-900">
                    {format(selectedDate, 'HH:mm')} às {format(addMinutes(selectedDate, totalDuration), 'HH:mm')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Serviços</p>
              <div className="space-y-2">
                {selectedServices.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>{s.nome}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4">
            <button
              onClick={handleWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white transition-all hover:bg-emerald-700 shadow-lg shadow-emerald-100"
            >
              <MessageCircle size={20} />
              <span>Falar com a estética</span>
            </button>

            <button
              onClick={() => navigate(`/${slug}/agenda`)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
            >
              <span>Ver meus agendamentos</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-4 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-pink-600"
      >
        <ArrowLeft size={16} />
        <span>Voltar</span>
      </button>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Lado Esquerdo: Detalhes */}
        <div className="flex-1 space-y-8">
          <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-100">
            {/* Header da Estética */}
            <div className="bg-slate-950 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-white/20 bg-white">
                  {establishment?.logo_url ? (
                    <img src={establishment.logo_url} alt={establishment.nome} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-black text-slate-900">
                      {establishment?.nome?.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{establishment?.nome}</h2>
                  <p className="text-xs font-medium text-white/60">Agendamento Profissional ✨</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                      <CalendarDays size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Data</p>
                      <p className="font-bold text-slate-900 capitalize">
                        {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
                      <Clock3 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Horário</p>
                      <p className="font-bold text-slate-900">
                        {format(selectedDate, 'HH:mm')} → {format(addMinutes(selectedDate, totalDuration), 'HH:mm')}
                      </p>
                      <p className="text-xs font-medium text-slate-400">{totalDuration} min de duração</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Serviços Selecionados</p>
                  <div className="space-y-3">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex justify-between gap-2">
                        <span className="text-sm font-bold text-slate-700">{s.nome}</span>
                        <span className="text-sm font-bold text-slate-900">{formatPrice(s.preco)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-4 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-900">Valor Total</span>
                    <span className="text-xl font-black text-pink-600">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Ação Final */}
        <aside className="w-full lg:w-[320px] space-y-6">
          <div className="space-y-4">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 py-5 text-base font-black text-white transition-all hover:bg-pink-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-pink-100"
            >
              <span>Confirmar Agora</span>
              <ArrowLeft size={20} className="rotate-180 transition-transform group-hover:translate-x-1" />
            </button>
            
            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Ambiente Seguro
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
