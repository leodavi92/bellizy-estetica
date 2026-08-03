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
  Sparkles,
  User,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createAppointment, getServices } from '../services/appointmentService';
import { getEstablishmentBySlug } from '../services/establishmentService';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

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
    totalPrice = 0,
    assignments = '', // Novo: serviceId:professionalId,...
    professionalId = null 
  } = location.state || {};

  const [establishment, setEstablishment] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPolicyAccepted, setIsPolicyAccepted] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [conflictError, setConflictError] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [professional, setProfessional] = useState(null);
  const [assignedProfessionals, setAssignedProfessionals] = useState({}); // Mapa de professionalId -> dados do prof
  const [observacoes, setObservacoes] = useState(''); // Campo de observações do cliente

  const selectedDate = useMemo(() => selectedDateStr ? new Date(selectedDateStr) : null, [selectedDateStr]);

  const selectedServices = useMemo(() => {
    if (!selectedServicesIds || services.length === 0) return [];
    const ids = selectedServicesIds.split(',');
    return services.filter(s => ids.includes(s.id));
  }, [services, selectedServicesIds]);

  // Parse das atribuições para facilitar o uso na UI e aplicar REORDENAMENTO POR PRIORIDADE
  const serviceAssignments = useMemo(() => {
    if (!assignments || selectedServices.length === 0) return [];
    
    const parsed = assignments.split(',').map(pair => {
      const [sId, pId] = pair.split(':');
      const service = selectedServices.find(s => s.id === sId);
      return { service, professionalId: pId };
    });

    // Ordenar por prioridade (idêntico ao motor de busca)
    return parsed.sort((a, b) => {
      const prioA = a.service?.prioridade || 0;
      const prioB = b.service?.prioridade || 0;
      return prioB - prioA;
    });
  }, [assignments, selectedServices]);

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

        // Busca dados de TODOS os profissionais envolvidos
        if (assignments) {
          const profIds = [...new Set(assignments.split(',').map(p => p.split(':')[1]))];
          const profsData = {};
          
          for (const id of profIds) {
            if (id === 'owner') {
              profsData[id] = {
                id: 'owner',
                nome: estData.nome || 'Profissional Principal',
                cargo: 'Especialista Principal'
              };
            } else {
              const profDoc = await getDoc(doc(db, "professionals", id));
              if (profDoc.exists()) {
                profsData[id] = { id: profDoc.id, ...profDoc.data() };
              }
            }
          }
          setAssignedProfessionals(profsData);
        } else if (professionalId) {
          // Fallback legacy
          if (professionalId === 'owner') {
            const owner = {
              id: 'owner',
              nome: estData.nome || 'Profissional Principal',
              cargo: 'Especialista Principal'
            };
            setProfessional(owner);
            setAssignedProfessionals({ owner });
          } else {
            const profDoc = await getDoc(doc(db, "professionals", professionalId));
            if (profDoc.exists()) {
              const pData = { id: profDoc.id, ...profDoc.data() };
              setProfessional(pData);
              setAssignedProfessionals({ [professionalId]: pData });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar confirmação:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, selectedDate, navigate, professionalId, assignments]);

  const handleConfirm = async () => {
    if (!establishment || !user || selectedServices.length === 0) {
      alert("Dados incompletos para o agendamento.");
      return;
    }

    if (!isPolicyAccepted) {
      alert("É necessário aceitar a Política de Privacidade e os Termos de Uso para confirmar seu agendamento (LGPD, Lei 13.709/2018).");
      return;
    }

    try {
      setLoading(true);

      const start = selectedDate;
      const dur = totalDuration;
      
      // Prova LGPD — capturada no momento exato do clique (ato jurídico)
      const consentimento = {
        version: 1,
        accepted_at: new Date().toISOString(),
        source: 'booking-confirmation-submit',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };
      
      // Gera o Itinerário de Beleza (horários quebrados por serviço)
      let currentOffset = 0;
      const itinerary = serviceAssignments.map(a => {
        const sStart = addMinutes(start, currentOffset);
        const sDur = Number(a.service.duracao || 30);
        const sEnd = addMinutes(sStart, sDur);
        const item = {
          service_id: a.service.id,
          service_nome: a.service.nome,
          professional_id: a.professionalId,
          professional_nome: assignedProfessionals[a.professionalId]?.nome || 'Profissional',
          start_time: sStart,
          end_time: sEnd,
          duracao: sDur,
          preco: Number(a.service.preco || 0)
        };
        currentOffset += sDur;
        return item;
      });

      const appointmentData = {
        establishment_id: establishment.id,
        establishment_name: establishment.nome,
        user_id: user.uid,
        user_nome: user.nome || user.displayName || 'Cliente',
        user_email: user.email || '',
        user_avatar: user.photoURL || user.avatar_url || '',
        user_telefone: user.telefone || user.phone || '',
        services: itinerary, // Agora com horários específicos por serviço
        itinerary: itinerary, // Salva duplicado para facilidade de acesso
        data_hora: start,
        total_duration: dur,
        total_price: totalPrice,
        professional_id: professionalId || serviceAssignments[0]?.professionalId || 'owner',
        professional_nome: professional?.nome || assignedProfessionals[serviceAssignments[0]?.professionalId]?.nome || '',
        service_id: selectedServices[0]?.id || '',
        service_nome: selectedServices.map(s => s.nome).join(', ') || 'Serviço',
        duration: dur,
        preco: totalPrice,
        assignments: assignments,
        observacoes: observacoes.trim(), // Campo de observações do cliente
        // -------------------------------------------------------------
        // LGPD — Prova de consentimento no ATO do agendamento (contrato)
        // -------------------------------------------------------------
        user_lgpd_consent: true,
        user_lgpd_consent_em: consentimento.accepted_at,
        user_lgpd_consent_version: consentimento.version,
        user_lgpd_consent_source: consentimento.source,
        user_lgpd_consent_ua: consentimento.userAgent,
      };

      // Também atualiza o users.doc com o consentimento mais recente (se usuário autenticado)
      const { updateUserDoc } = await import('../services/firebase');
      updateUserDoc(user.uid, {
        aceitou_lgpd_em: consentimento.accepted_at,
        aceitou_lgpd_version: consentimento.version,
        aceitou_lgpd_source: consentimento.source,
        aceitou_lgpd_ua: consentimento.userAgent
      }).catch(() => { /* ignore: appointment já tem a prova */ });

      const appointmentId = await createAppointment(appointmentData);
      
      setConfirmedAppointment({
        ...appointmentData,
        id: appointmentId,
        end_time: addMinutes(selectedDate, totalDuration)
      });
      setBookingSuccess(true);
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error);
      if (error.code === 'SLOT_TAKEN') {
        setConflictError(true);
      } else {
        alert('Erro ao confirmar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const buildResumoWhatsAppText = () => {
    const estName = establishment?.nome || 'Estabelecimento';
    const dataStr = selectedDate
      ? format(selectedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : '';
    const endStr = selectedDate
      ? format(addMinutes(selectedDate, totalDuration), 'HH:mm')
      : '';
    const servicesStr = (confirmedAppointment?.itinerary || confirmedAppointment?.services || [])
      .map(it => {
        const nome = it.service_nome || it.nome || 'Serviço';
        const prof = it.professional_nome ? `(${it.professional_nome})` : '';
        const time = it.start_time
          ? `${format(it.start_time.toDate ? it.start_time.toDate() : new Date(it.start_time), 'HH:mm')} — `
          : '';
        return `  • ${time}${nome} ${prof}`.trim();
      })
      .join('\n');
    const totalStr = formatPrice(confirmedAppointment?.total_price ?? totalPrice);
    const codigo = confirmedAppointment?.id?.slice(0, 8).toUpperCase() || '';
    const obss = observacoes.trim() ? `\n\n📝 Observações: ${observacoes.trim()}` : '';

    return [
      `🌸 Confirmação de Agendamento — ${estName}`,
      codigo ? `🔑 Código: #${codigo}` : '',
      `📅 Data: ${dataStr} até ${endStr}`,
      `⏱️ Duração total: ${totalDuration} min`,
      ``,
      `🛍️ Serviços:`,
      servicesStr || '  • (consulta)',
      ``,
      `💳 Valor total: ${totalStr}`,
      obss,
      ``,
      `✅ Horário confirmado! Em caso de cancelamento ou reagendamento, me avise com antecedência 💖`
    ].filter(Boolean).join('\n');
  };

  const handleWhatsApp = () => {
    if (!establishment?.telefone) return;
    const phone = establishment.telefone.replace(/\D/g, '');
    const text = bookingSuccess
      ? buildResumoWhatsAppText()
      : `Olá! Gostaria de falar sobre meu agendamento na ${establishment.nome}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const clienteTelefone = user?.telefone || user?.phone || confirmedAppointment?.user_telefone || '';
  const handleWhatsAppResumoPessoal = () => {
    if (!clienteTelefone) return;
    const phone = String(clienteTelefone).replace(/\D/g, '');
    if (!phone || phone.length < 10) return;
    const text = buildResumoWhatsAppText();
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank');
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
            animation: progress-bar 2s ease-in-out forwards;
          }
        `}} />
      </div>
    );
  }

  if (conflictError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 animate-in fade-in zoom-in duration-500">
        <div className="rounded-[3rem] bg-white p-10 text-center shadow-2xl shadow-slate-200 border-2 border-amber-100">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-amber-500 mb-6">
            <AlertTriangle size={56} />
          </div>
          
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Ops! Esse horário já foi preenchido.
          </h1>
          <p className="mt-4 text-slate-500 font-medium leading-relaxed">
            Parece que outra pessoa acabou de reservar esse mesmo horário enquanto você finalizava. ✨
            <br />
            Por favor, escolha outro horário disponível para o seu atendimento.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            <button
              onClick={() => navigate(`/${slug}/agendar/horarios/${selectedServicesIds}?professionalId=${professionalId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-600 py-5 text-base font-black text-white transition-all hover:bg-pink-700 shadow-xl shadow-pink-100 active:scale-95"
            >
              <Calendar size={20} />
              <span>Escolher outro horário</span>
            </button>

            <button
              onClick={() => navigate(`/${slug}/agendar`)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
            >
              <span>Voltar ao início</span>
            </button>
          </div>
        </div>
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
              {Object.values(assignedProfessionals).length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Profissional(is)</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.values(assignedProfessionals).map(prof => (
                      <div key={prof.id} className="flex items-center gap-3 bg-white p-2 pr-4 rounded-2xl shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 overflow-hidden shrink-0">
                          {prof.foto ? (
                            <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{prof.nome}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{prof.cargo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-pink-600">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Data</p>
                  <p className="font-bold text-slate-900 capitalize">
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
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
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Seu Itinerário de Beleza</p>
              <div className="space-y-4">
                {(() => {
                  let runningTime = selectedDate;
                  const items = confirmedAppointment?.itinerary || confirmedAppointment?.services || [];
                  
                  return items.map((item, idx) => {
                    let sTime = item.start_time?.toDate ? item.start_time.toDate() : (item.start_time ? new Date(item.start_time) : runningTime);
                    const sDur = Number(item.duracao || item.duration || 30);
                    runningTime = addMinutes(sTime, sDur);

                    return (
                      <div key={idx} className="flex gap-4 items-start group">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center text-xs font-black border-2 border-pink-100 group-hover:bg-pink-600 group-hover:text-white transition-all">
                            {format(sTime, 'HH:mm')}
                          </div>
                          {idx !== (items.length - 1) && (
                            <div className="w-0.5 h-10 bg-pink-100" />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{item.service_nome || item.nome}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-0.5">
                            <User size={10} className="text-pink-400" />
                            {item.professional_nome}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4">
            {clienteTelefone && (
              <button
                onClick={handleWhatsAppResumoPessoal}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-white transition-all hover:bg-emerald-600 shadow-lg shadow-emerald-100 active:scale-[0.99]"
              >
                <MessageCircle size={20} />
                <span>Salvar resumo no meu WhatsApp</span>
              </button>
            )}

            {establishment?.telefone && (
              <button
                onClick={handleWhatsApp}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 border-2 border-emerald-200 active:scale-[0.99]"
              >
                <MessageCircle size={20} />
                <span>Falar com a estética via WhatsApp</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/${slug}/agenda`)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
            >
              <CalendarDays size={18} />
              <span>Ver meus agendamentos</span>
            </button>

            <button
              onClick={() => navigate(`/${slug}/agendar`)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-50 py-4 text-sm font-bold text-pink-700 transition-all hover:bg-pink-100 border-2 border-pink-100"
            >
              <PlusCircle size={18} />
              <span>Agendar outro horário</span>
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

                  {Object.values(assignedProfessionals).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Profissionais</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(assignedProfessionals).map(prof => (
                          <div key={prof.id} className="flex items-center gap-3 bg-white p-2 pr-4 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 overflow-hidden shrink-0">
                              {prof.foto ? (
                                <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                              ) : (
                                <User size={20} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{prof.nome}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{prof.cargo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl bg-slate-50 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Serviços Selecionados</p>
                  <div className="space-y-4">
                    {serviceAssignments.map(a => (
                      <div key={a.service.id} className="space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-sm font-bold text-slate-700">{a.service.nome}</span>
                          <span className="text-sm font-bold text-slate-900">{formatPrice(a.service.preco)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-pink-500 bg-pink-50 w-fit px-1.5 py-0.5 rounded-md">
                          <User size={10} />
                          {assignedProfessionals[a.professionalId]?.nome || 'Profissional'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 border-t border-slate-200 pt-4 flex justify-between items-center">
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
            {/* Campo de Observações */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Observações para a profissional
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Quero a cor vermelha escura, ou chego 5 minutos atrasado..."
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-4 py-4 text-sm text-slate-900 outline-none focus:border-pink-300 focus:bg-white transition-all resize-none"
                rows={4}
              />
            </div>

            {/* Checkbox LGPD Obrigatório */}
            <div className="rounded-2xl border-2 border-pink-100 bg-pink-50/40 p-4 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPolicyAccepted}
                  onChange={(e) => setIsPolicyAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-xs font-bold leading-snug text-slate-700">
                  Li e concordo expressamente com a{' '}
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('musa:lgpd', { detail: { open: 'privacy' } }))}
                    className="font-black text-pink-600 underline underline-offset-2 hover:text-pink-700"
                  >
                    Política de Privacidade
                  </button>{' '}
                  e os{' '}
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('musa:lgpd', { detail: { open: 'terms' } }))}
                    className="font-black text-pink-600 underline underline-offset-2 hover:text-pink-700"
                  >
                    Termos de Uso
                  </button>
                  , autorizando o tratamento dos meus dados (nome, telefone, e-mail e dados de agendamento) conforme a LGPD (Lei 13.709/2018).
                </span>
              </label>
              {!isPolicyAccepted && (
                <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 ml-7">
                  ⚠ Aceite obrigatório para confirmar
                </p>
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={loading || !isPolicyAccepted}
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
