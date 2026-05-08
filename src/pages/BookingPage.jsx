import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, LayoutGrid, Info } from 'lucide-react';
import { getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';
import ServiceSelectionCard from '../components/booking/ServiceSelectionCard';
import BookingSummary from '../components/booking/BookingSummary';
import CheckoutFooter from '../components/booking/CheckoutFooter';

export default function BookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      if (!slug || slug === 'login') return;

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
      } catch (error) {
        console.error('Erro ao carregar pagina de agendamento:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug]);

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const totals = useMemo(() => {
    return selectedServices.reduce((acc, service) => ({
      price: acc.price + Number(service.preco || 0),
      duration: acc.duration + Number(service.duracao || 0)
    }), { price: 0, duration: 0 });
  }, [selectedServices]);

  const handleContinue = () => {
    if (selectedServices.length === 0) return;
    const ids = selectedServices.map(s => s.id).join(',');
    navigate(`/${slug}/agendar/horarios/${ids}`);
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
        <h2 className="text-2xl font-bold text-slate-800">Estética não encontrada</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-32 pt-4">
      {/* Header com Navegação */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(`/${slug}`)}
          className="group flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-pink-600"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-pink-50">
            <ArrowLeft size={16} />
          </div>
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2 rounded-full bg-pink-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-pink-600">
          <Sparkles size={12} strokeWidth={3} />
          <span>Agendamento Online</span>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-200">
                <LayoutGrid size={20} />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Selecione os Serviços
              </h1>
            </div>
            <p className="mt-3 text-slate-500">
              Escolha um ou mais serviços para montar seu pacote de atendimento personalizado.
            </p>
          </div>

          {services.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-1">
              {services.map((service) => (
                <ServiceSelectionCard
                  key={service.id}
                  service={service}
                  isSelected={selectedServices.some(s => s.id === service.id)}
                  onSelect={toggleService}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-white py-20 text-center">
              <div className="mb-4 rounded-full bg-slate-50 p-4 text-slate-300">
                <LayoutGrid size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Nenhum serviço disponível</h3>
              <p className="mt-1 text-sm text-slate-400">
                Não há serviços cadastrados no momento.
              </p>
            </div>
          )}
        </div>

        {/* Desktop Sidebar Summary */}
        <aside className="hidden w-full lg:block lg:w-[380px]">
          {selectedServices.length > 0 ? (
            <BookingSummary 
              selectedServices={selectedServices}
              totals={totals}
              onContinue={handleContinue}
              onRemove={toggleService}
            />
          ) : (
            <div className="sticky top-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-sm font-medium text-slate-400">
                Selecione um serviço para ver o resumo do agendamento aqui.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Floating Footer */}
      <CheckoutFooter 
        selectedServices={selectedServices}
        totals={totals}
        onContinue={handleContinue}
      />
    </div>
  );
}
