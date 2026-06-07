import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { addMinutes, format, isAfter, isSameDay, startOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { createAppointment, getAvailableSlots, getMultiProfessionalAvailableSlots, getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';
import ScheduleSection from '../components/client/ScheduleSection';

export default function BookingSchedulePage() {
  const { user } = useAuth();
  const { slug, serviceId } = useParams(); // serviceId aqui pode ser uma lista separada por vírgula
  const navigate = useNavigate();
  const location = useLocation();

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [professional, setProfessional] = useState(null);

  // Pega o ID do profissional da URL (fallback para agendamentos simples)
  const professionalId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('professionalId');
  }, [location.search]);

  // Pega as atribuições de profissionais (serviceId:professionalId) da URL
  const assignments = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('assignments');
    if (!raw) return [];
    return raw.split(',').map(pair => {
      const [sId, pId] = pair.split(':');
      return { serviceId: sId, professionalId: pId };
    });
  }, [location.search]);

  // Parse múltiplo de serviços
  const selectedServices = useMemo(() => {
    if (!serviceId || services.length === 0) return [];
    const ids = serviceId.split(',');
    return services.filter(s => ids.includes(s.id));
  }, [services, serviceId]);

  // Associa o objeto de serviço completo com o profissional atribuído e ordena por PRIORIDADE
  const serviceAssignments = useMemo(() => {
    if (selectedServices.length === 0 || assignments.length === 0) return [];
    const unsorted = selectedServices.map(service => {
      const found = assignments.find(a => a.serviceId === service.id);
      return {
        service,
        professionalId: found ? found.professionalId : 'owner'
      };
    });

    // Ordenar por prioridade (Maior primeiro)
    return unsorted.sort((a, b) => {
      const prioA = a.service?.prioridade || 0;
      const prioB = b.service?.prioridade || 0;
      return prioB - prioA;
    });
  }, [selectedServices, assignments]);

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

        // Busca dados do profissional se houver um ID
        if (professionalId && professionalId !== 'owner') {
          const profDoc = await getDoc(doc(db, "professionals", professionalId));
          if (profDoc.exists()) {
            setProfessional({ id: profDoc.id, ...profDoc.data() });
          }
        } else if (professionalId === 'owner') {
          setProfessional({
            id: 'owner',
            nome: estData.nome || 'Profissional Principal',
            cargo: 'Especialista Principal',
            isOwner: true
          });
        }

        const servicesData = await getServices(estData.id);
        setServices(servicesData);
      } catch (error) {
        console.error('Erro ao carregar horarios:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug, serviceId, professionalId]);

  useEffect(() => {
    if (selectedServices.length === 0 || !establishment) return;

    async function loadSlots() {
      setLoadingSlots(true);
      try {
        let slots = [];
        if (serviceAssignments.length > 0) {
          // Novo cálculo multi-profissional
          slots = await getMultiProfessionalAvailableSlots(selectedDate, serviceAssignments, establishment.id);
        } else {
          // Fallback para agendamento simples (compatibilidade)
          const params = new URLSearchParams(location.search);
          const singleProfId = params.get('professionalId');
          slots = await getAvailableSlots(selectedDate, totalDuration, establishment.id, singleProfId);
        }
        setAvailableSlots(slots);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedDate, totalDuration, establishment, selectedServices, serviceAssignments, location.search]);

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
      setShowLoginModal(true);
      return;
    }

    const params = new URLSearchParams(location.search);
    const assignmentsParam = params.get('assignments');

    // Redirecionamos para a página de confirmação profissional
    navigate(`/${slug}/agendar/confirmacao`, {
      state: {
        selectedServicesIds: serviceId,
        selectedDateStr: slot.toISOString(),
        totalDuration,
        totalPrice,
        assignments: assignmentsParam, // Passa as atribuições para a próxima tela
        professionalId: params.get('professionalId') // Compatibilidade
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        <p className="font-medium text-pink-600 italic">Musa Agenda...</p>
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

      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-600 to-rose-500" />
              
              <div className="w-20 h-20 bg-pink-50 text-pink-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-pink-50">
                <Sparkles size={40} className="animate-pulse" />
              </div>

              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase mb-3">
                Quase lá! ✨
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Para garantir seu horário e receber as confirmações, você precisa entrar na sua conta ou criar uma rapidinho.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                >
                  Entrar ou Cadastrar
                </button>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="w-full py-4 bg-white text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-all"
                >
                  Depois eu faço isso
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
