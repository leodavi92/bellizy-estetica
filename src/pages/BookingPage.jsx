import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, LayoutGrid, Info, User, Check, ChevronRight } from 'lucide-react';
import { getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import ServiceSelectionCard from '../components/booking/ServiceSelectionCard';
import BookingSummary from '../components/booking/BookingSummary';
import CheckoutFooter from '../components/booking/CheckoutFooter';

export default function BookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]); // Array de { service, professionalId }
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper para verificar se um serviço está selecionado e quem é o profissional
  const getSelectedInfo = (serviceId) => selectedServices.find(s => s.service.id === serviceId);

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

        // Busca a equipe do estabelecimento
        const teamQuery = query(
          collection(db, "professionals"),
          where("establishment_id", "==", estData.id)
        );
        const teamSnap = await getDocs(teamQuery);
        const teamData = teamSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Adiciona a "Dona" como opção também se não houver equipe ou como opção principal
        const owner = {
          id: 'owner',
          nome: estData.nome || 'Profissional',
          cargo: 'Especialista Principal',
          foto: estData.photoURL || estData.logo_url || '',
          isOwner: true
        };
        
        const fullTeam = [owner, ...teamData];
        setTeam(fullTeam);

        // Pré-seleção de serviço via Query Param
        const params = new URLSearchParams(location.search);
        const preSelectedId = params.get('serviceId');
        if (preSelectedId && servicesData.length > 0) {
          const service = servicesData.find(s => s.id === preSelectedId);
          if (service) {
            // Se tiver apenas um profissional que faz esse serviço, já pré-seleciona
            const possibleProfs = fullTeam.filter(p => p.isOwner || (p.servicos && p.servicos.includes(service.id)));
            const initialProfId = possibleProfs.length === 1 ? possibleProfs[0].id : null;
            setSelectedServices([{ service: service, professionalId: initialProfId }]);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar pagina de agendamento:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug, location.search]);

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.service.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.service.id !== service.id);
      } else {
        // Verifica se só tem um profissional possível para esse serviço
        const possibleProfs = team.filter(p => p.isOwner || (p.servicos && p.servicos.includes(service.id)));
        const initialProfId = possibleProfs.length === 1 ? possibleProfs[0].id : null;
        return [...prev, { service: service, professionalId: initialProfId }];
      }
    });
  };

  const handleSelectProfessionalForService = (serviceId, professionalId) => {
    setSelectedServices(prev => prev.map(s => 
      s.service.id === serviceId ? { ...s, professionalId } : s
    ));
  };

  const totals = useMemo(() => {
    return selectedServices.reduce((acc, selected) => ({
      price: acc.price + Number(selected.service.preco || 0),
      duration: acc.duration + Number(selected.service.duracao || 0)
    }), { price: 0, duration: 0 });
  }, [selectedServices]);

  // Helper para Avatar do Profissional
  const renderProfessionalAvatar = (member) => {
    if (member.foto) {
      return <img src={member.foto} alt={member.nome} className="w-full h-full object-cover" />;
    }
    
    const colors = [
      'bg-pink-100 text-pink-600',
      'bg-purple-100 text-purple-600',
      'bg-blue-100 text-blue-600',
      'bg-indigo-100 text-indigo-600',
      'bg-emerald-100 text-emerald-600',
      'bg-rose-100 text-rose-600',
      'bg-amber-100 text-amber-600'
    ];
    
    const charCode = (member.nome || 'M').charCodeAt(0);
    const colorIndex = charCode % colors.length;
    const initials = (member.nome || 'M').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
      <div className={`w-full h-full ${colors[colorIndex]} flex items-center justify-center font-black text-xl tracking-tighter`}>
        {initials}
      </div>
    );
  };

  const handleContinue = () => {
    if (selectedServices.length === 0) return;
    
    // Verifica se todos os serviços selecionados têm um profissional atribuído
    const missingProfessional = selectedServices.find(s => !s.professionalId);
    if (missingProfessional) {
      alert(`Por favor, selecione um profissional para o serviço: ${missingProfessional.service.nome}`);
      return;
    }

    // REORDENAMENTO POR PRIORIDADE: Garante que serviços prioritários venham primeiro na sequência
    const sortedServices = [...selectedServices].sort((a, b) => {
      const prioA = a.service?.prioridade || 0;
      const prioB = b.service?.prioridade || 0;
      return prioB - prioA;
    });

    // Criamos um mapa de serviceId -> professionalId
    const assignments = sortedServices.map(s => `${s.service.id}:${s.professionalId}`).join(',');
    const serviceIds = sortedServices.map(s => s.service.id).join(',');
    
    navigate(`/${slug}/agendar/horarios/${serviceIds}?assignments=${assignments}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        <p className="font-medium text-pink-600 italic">Musa Agenda...</p>
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
            <div className="grid gap-6">
              {services.map((service) => {
                const selectedInfo = getSelectedInfo(service.id);
                const isSelected = !!selectedInfo;
                
                // Profissionais que fazem este serviço específico
                const possibleProfs = team.filter(p => p.isOwner || (p.servicos && p.servicos.includes(service.id)));

                return (
                  <div key={service.id} className="space-y-3">
                    <ServiceSelectionCard
                      service={service}
                      isSelected={isSelected}
                      onSelect={toggleService}
                    />
                    
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-slate-50/50 rounded-[2rem] p-6 border-2 border-dashed border-slate-200 ml-4">
                            <div className="flex items-center gap-2 mb-4">
                              <User size={14} className="text-pink-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quem vai te atender neste serviço?</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {possibleProfs.map(prof => (
                                <button
                                  key={prof.id}
                                  onClick={() => handleSelectProfessionalForService(service.id, prof.id)}
                                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                                    selectedInfo.professionalId === prof.id
                                      ? 'border-pink-600 bg-white shadow-md'
                                      : 'border-white bg-white/50 hover:border-pink-200'
                                  }`}
                                >
                                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-pink-100 shrink-0 shadow-sm">
                                    {renderProfessionalAvatar(prof)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold truncate ${selectedInfo.professionalId === prof.id ? 'text-pink-600' : 'text-slate-700'}`}>
                                      {prof.nome}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{prof.cargo}</p>
                                  </div>
                                  {selectedInfo.professionalId === prof.id && (
                                    <div className="ml-auto bg-pink-600 text-white rounded-full p-0.5">
                                      <Check size={10} strokeWidth={4} />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
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
              selectedServices={selectedServices.map(s => s.service)}
              totals={totals}
              onContinue={handleContinue}
              onRemove={(service) => toggleService(service)}
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
        selectedServices={selectedServices.map(s => s.service)}
        totals={totals}
        onContinue={handleContinue}
      />
    </div>
  );
}
