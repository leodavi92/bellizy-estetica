import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { addMinutes, format, isAfter, isSameDay, startOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { createAppointment, getAvailableSlots, getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';
import ScheduleSection from '../components/client/ScheduleSection';

export default function BookingSchedulePage() {
  const { user } = useAuth();
  const { slug, serviceId } = useParams(); // serviceId aqui pode ser uma lista separada por vírgula
  const navigate = useNavigate();

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [allAdminAppointments, setAllAdminAppointments] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Parse múltiplo de serviços
  const selectedServices = useMemo(() => {
    if (!serviceId || services.length === 0) return [];
    const ids = serviceId.split(',');
    return services.filter(s => ids.includes(s.id));
  }, [services, serviceId]);

  const totalDuration = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + Number(s.duracao || 0), 0);
  }, [selectedServices]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + Number(s.preco || 0), 0);
  }, [selectedServices]);

  const safeToDate = (dateObj) => {
    if (!dateObj) return new Date();
    if (dateObj.toDate) return dateObj.toDate();
    return new Date(dateObj);
  };

  useEffect(() => {
    async function loadInitialData() {
      if (!slug || !serviceId) return;

      try {
        setLoading(true);
        const estData = await getEstablishmentBySlug(slug);

        if (!estData) {
          setEstablishment('not_found');
          return;
        }

        setEstablishment(estData);

        const servicesData = await getServices(estData.id);
        setServices(servicesData);

        const q = query(
          collection(db, 'appointments'),
          where('establishment_id', '==', estData.id),
          where('status', '==', 'ativo')
        );
        const snap = await getDocs(q);
        setAllAdminAppointments(snap.docs.map((item) => {
          const data = item.data();
          // Normalizar para facilitar verificação de disponibilidade
          const start = data.start_time ? data.start_time.toDate() : data.data_hora.toDate();
          const end = data.end_time ? data.end_time.toDate() : addMinutes(start, data.duration || 30);
          return { id: item.id, ...data, start, end };
        }));
      } catch (error) {
        console.error('Erro ao carregar horarios:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug, serviceId]);

  useEffect(() => {
    if (selectedServices.length === 0 || !establishment) return;

    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const slots = await getAvailableSlots(selectedDate, totalDuration, establishment.id);
        setAvailableSlots(slots);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedDate, totalDuration, establishment, selectedServices]);

  const checkDayAvailability = (date) => {
    if (!establishment || selectedServices.length === 0) return false;
    if (isAfter(startOfDay(new Date()), startOfDay(date))) return false;

    const availabilityRules = establishment.availability_rules;
    const dayName = format(date, 'eeee', { locale: enUS }).toLowerCase();
    const dayConfig = availabilityRules ? availabilityRules[dayName] : null;

    // Se o dia não estiver habilitado na regra semanal, não está disponível
    if (dayConfig && !dayConfig.enabled) return false;

    // Se não houver regra semanal definida, usa o padrão antigo
    if (!dayConfig) {
      const settings = establishment.settings || { horario_inicio: '08:00', horario_fim: '18:00' };
      const workingDays = settings.dias_trabalho || [1, 2, 3, 4, 5, 6];
      if (!workingDays.includes(date.getDay())) return false;
    }

    // Verifica se o dia está totalmente bloqueado manualmente
    const blockedSlots = establishment.blocked_slots || [];
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBlock = blockedSlots.find(b => b.date === dateStr && b.start_time === "00:00" && b.end_time === "23:59");
    if (dayBlock) return false;

    // Para uma verificação mais profunda, precisaríamos dos busySlots (agendamentos)
    // Mas por enquanto, a regra semanal e os bloqueios manuais já cobrem o básico.
    // O getAvailableSlots fará a verificação real ao clicar no dia.
    return true;
  };

  async function handleBook(slot) {
    if (!user) {
      alert('Para agendar, voce precisa entrar na sua conta. Vamos te levar para a tela de acesso.');
      navigate('/login');
      return;
    }

    // Em vez de confirmar e salvar aqui, redirecionamos para a página de confirmação profissional
    navigate(`/${slug}/agendar/confirmacao`, {
      state: {
        selectedServicesIds: serviceId, // O serviceId aqui já pode conter os IDs separados por vírgula
        selectedDateStr: slot.toISOString(),
        totalDuration,
        totalPrice
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        <p className="font-medium text-pink-600 italic">Bellizy...</p>
      </div>
    );
  }

  if (establishment === 'not_found' || selectedServices.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-pink-50 text-pink-400">
          <Sparkles size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Serviço não encontrado</h2>
        <button
          onClick={() => navigate(`/${slug}/agendar`)}
          className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl animate-in slide-in-from-right-6 duration-300 pb-14">
      <ScheduleSection
        selectedService={selectedServices[0]} // Passando o primeiro apenas para compatibilidade visual se necessário
        selectedServices={selectedServices}
        totalDuration={totalDuration}
        totalPrice={totalPrice}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        onBook={handleBook}
        onBack={() => navigate(`/${slug}/agendar`)}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        checkDayAvailability={checkDayAvailability}
      />

      {bookingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={46} />
            </div>
            <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-900">Horario confirmado</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Seu agendamento foi realizado com sucesso.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
