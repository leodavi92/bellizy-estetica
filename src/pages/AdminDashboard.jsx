import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../services/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  Timestamp, 
  where,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Pencil,
  Trash2, 
  Calendar, 
  Settings, 
  Clock, 
  Users, 
  TrendingUp, 
  DollarSign, 
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  User,
  Store,
  MapPin,
  Phone,
  LogOut,
  Instagram,
  Image as ImageIcon,
  Shield,
  ShieldAlert,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { isSlugAvailable, sanitizeSlug } from '../services/establishmentService';
import OnboardingWizard from '../components/admin/onboarding/OnboardingWizard';
import WeeklyAvailabilityEditor from '../components/admin/settings/WeeklyAvailabilityEditor';
import CancellationPolicySettings from '../components/admin/settings/CancellationPolicySettings';
import AvailabilityCalendar from '../components/admin/settings/AvailabilityCalendar';
import NextAppointmentSection from '../components/admin/dashboard/NextAppointmentSection';
import AppointmentCalendar from '../components/admin/dashboard/AppointmentCalendar';
import SidebarContent from '../components/admin/dashboard/SidebarContent';
import { MobileTopbar, MobileDrawer } from '../components/admin/dashboard/MobileNavigation';
import { motion, AnimatePresence } from 'framer-motion';

const DESCRIPTION_LIMIT = 140;
const POLICY_LIMIT = 220;
const SERVICE_DESCRIPTION_LIMIT = 160;

export default function AdminDashboard() {
  const { user, establishment, logout } = useAuth();
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]); // Todos os agendamentos do admin
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('overview'); // 'overview', 'agenda', 'financas', 'servicos', 'config', 'clientes'
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [agendaView, setAgendaView] = useState('list'); // 'list', 'calendar'
  const [showWeeklyEditor, setShowWeeklyEditor] = useState(false);
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: true, message: '' });
  const [tempSlug, setTempSlug] = useState(establishment?.slug || '');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Sincroniza tempSlug quando o estabelecimento carregar
  useEffect(() => {
    if (establishment?.slug && !tempSlug) {
      setTempSlug(establishment.slug);
    }
  }, [establishment?.slug]);
  const [newService, setNewService] = useState({ nome: '', descricao: '', duracao: 30, preco: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Se o perfil não estiver completo, exibe o Onboarding
  const isProfileIncomplete = establishment && establishment.profile_completed === false;
  const [businessSettings, setBusinessSettings] = useState({
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_trabalho: [1, 2, 3, 4, 5, 6] // Seg a Sab
  });
  const [profileInfo, setProfileInfo] = useState({
    nome: '',
    endereco: '',
    telefone: '',
    descricao: '',
    logo_url: '',
    photoURL: '',
    banner_url: '',
    instagram: '',
    horario_funcionamento: '',
    politica_cancelamento: ''
  });

  useEffect(() => {
    if (establishment) {
      setProfileInfo({
        nome: establishment.nome || establishment.name || '',
        endereco: establishment.endereco || establishment.address || '',
        telefone: establishment.telefone || establishment.phone || '',
        descricao: establishment.descricao || '',
        logo_url: establishment.logo_url || '',
        photoURL: user?.photoURL || establishment.photoURL || '',
        banner_url: establishment.banner_url || '',
        instagram: establishment.instagram || '',
        horario_funcionamento: establishment.horario_funcionamento || '',
        politica_cancelamento: establishment.politica_cancelamento || ''
      });
      setBusinessSettings(establishment.settings || {
        horario_inicio: '08:00',
        horario_fim: '18:00',
        dias_trabalho: [1, 2, 3, 4, 5, 6]
      });
    }
  }, [establishment, user?.photoURL]);

  // ESCUTA EM TEMPO REAL: Monitora todos os serviços do estabelecimento
  useEffect(() => {
    if (!establishment?.id) return;

    const q = query(
      collection(db, "services"),
      where("establishment_id", "==", establishment.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const servicesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Firestore: Total de serviços recebidos:", servicesData.length);
      setServices(servicesData);
    }, (error) => {
      console.error("Erro na escuta de serviços:", error);
    });

    return () => unsubscribe();
  }, [establishment?.id]);

  // ESCUTA EM TEMPO REAL: Monitora todos os agendamentos do estabelecimento
  useEffect(() => {
    if (!establishment?.id) return;

    const q = query(
      collection(db, "appointments"),
      where("establishment_id", "==", establishment.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Firestore: Total de agendamentos recebidos:", apps.length);
      setAllAppointments(apps);
    }, (error) => {
      console.error("Erro na escuta em tempo real:", error);
    });

    return () => unsubscribe();
  }, [establishment?.id]);

  // Filtragem da agenda sempre que a data selecionada ou a lista total mudar
  useEffect(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    const filtered = allAppointments
      .filter(app => {
        // Garantir que temos um objeto Date válido para comparar
        const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
        return appDate >= dayStart && appDate <= dayEnd;
      })
      .sort((a, b) => {
        const dateA = a.data_hora?.toDate ? a.data_hora.toDate() : new Date(a.data_hora);
        const dateB = b.data_hora?.toDate ? b.data_hora.toDate() : new Date(b.data_hora);
        return dateA - dateB;
      });

    console.log("Agenda: Filtrando para", format(selectedDate, 'dd/MM/yyyy'), "| Encontrados:", filtered.length);
    setAppointments(filtered);
  }, [selectedDate, allAppointments]);

  useEffect(() => {
    if (!establishment?.id) return;
    setLoading(true);
    // O settings agora vem direto do objeto establishment carregado no AuthContext
    setLoading(false);
  }, [establishment?.id]);

  async function handleSaveService(e) {
    e.preventDefault();
    try {
      setLoading(true);

      const servicePayload = {
        ...newService,
        descricao: (newService.descricao || '').trim(),
        establishment_id: establishment.id,
        duracao: Number(newService.duracao),
        preco: Number(newService.preco)
      };

      if (editingServiceId) {
        await updateDoc(doc(db, "services", editingServiceId), servicePayload);
      } else {
        await addDoc(collection(db, "services"), {
          ...servicePayload,
          createdAt: Timestamp.now()
        });
      }

      setNewService({ nome: '', descricao: '', duracao: 30, preco: '' });
      setEditingServiceId(null);
      alert(editingServiceId ? "Serviço atualizado com sucesso!" : "Serviço adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar serviço:", error);
      alert("Erro ao salvar serviço.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteService(id) {
    if (!window.confirm("Excluir serviço?")) return;
    try {
      await deleteDoc(doc(db, "services", id));
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      alert("Erro ao excluir serviço. Verifique sua conexão.");
    }
  }

  function handleEditService(service) {
    setEditingServiceId(service.id);
    setView('servicos');
    setNewService({
      nome: service.nome || '',
      descricao: service.descricao || '',
      duracao: service.duracao || 30,
      preco: service.preco || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetServiceForm() {
    setEditingServiceId(null);
    setNewService({ nome: '', descricao: '', duracao: 30, preco: '' });
  }

  async function handleCancelAppointment(id) {
    if (!window.confirm("Cancelar agendamento?")) return;
    try {
      await updateDoc(doc(db, "appointments", id), { status: 'cancelled' });
      // O onSnapshot cuidará da atualização automática
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      alert("Erro ao cancelar agendamento. Verifique sua conexão.");
    }
  }

  // Validação de Slug em tempo real
  useEffect(() => {
    setSlugSaved(false);
    const checkSlug = async () => {
      if (!tempSlug || tempSlug === establishment?.slug) {
        setSlugStatus({ checking: false, available: true, message: '' });
        return;
      }

      setSlugStatus({ checking: true, available: false, message: 'Verificando...' });
      const cleanSlug = sanitizeSlug(tempSlug);
      
      const isAvailable = await isSlugAvailable(cleanSlug, establishment?.id);
      
      if (isAvailable) {
        setSlugStatus({ checking: false, available: true, message: 'Link disponível!' });
      } else {
        setSlugStatus({ checking: false, available: false, message: 'Link já está em uso.' });
      }
    };

    const timeoutId = setTimeout(checkSlug, 500);
    return () => clearTimeout(timeoutId);
  }, [tempSlug, establishment?.slug, establishment?.id]);

  const isSlugDirty = sanitizeSlug(tempSlug) !== (establishment?.slug || '');

  const handleSaveSlug = async () => {
    if (!establishment?.id) return;
    if (!slugStatus.available || slugStatus.checking) return;
    if (!isSlugDirty) return;

    try {
      setSlugSaving(true);
      const cleanSlug = sanitizeSlug(tempSlug);
      await updateDoc(doc(db, 'establishments', establishment.id), { slug: cleanSlug });
      setSlugSaved(true);
    } catch (error) {
      console.error('Erro ao salvar link:', error);
      setSlugSaved(false);
    } finally {
      setSlugSaving(false);
    }
  };

  async function saveSettings(e) {
    e.preventDefault();
    try {
      setLoading(true);
      
      const updateData = {
        nome: profileInfo.nome,
        name: profileInfo.nome,
        endereco: profileInfo.endereco,
        address: profileInfo.endereco,
        telefone: profileInfo.telefone,
        phone: profileInfo.telefone,
        descricao: profileInfo.descricao.trim(),
        logo_url: profileInfo.logo_url,
        photoURL: profileInfo.photoURL,
        instagram: profileInfo.instagram
      };

      // Atualiza o documento do estabelecimento
      await updateDoc(doc(db, 'establishments', establishment.id), updateData);
      
      // Atualiza o nome do usuário admin também
      await updateDoc(doc(db, 'users', user.uid), { 
        nome: profileInfo.nome,
        endereco: profileInfo.endereco,
        telefone: profileInfo.telefone,
        photoURL: profileInfo.photoURL
      });

      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  // Cálculos de Overview
  const activeAppointments = appointments.filter(a => a.status === 'ativo' || a.status === 'scheduled' || a.status === 'confirmado');
  const dailyRevenue = activeAppointments.reduce((sum, a) => sum + (a.total_price || a.preco || 0), 0);
  const totalServices = activeAppointments.length;

  // Estatísticas Globais
  const globalActiveApps = allAppointments.filter(a => a.status === 'ativo' || a.status === 'scheduled' || a.status === 'confirmado');
  const totalGlobalApps = globalActiveApps.length;
  const totalGlobalRevenue = globalActiveApps.reduce((sum, a) => sum + (a.total_price || a.preco || 0), 0);

  const currentSlug = establishment?.slug || tempSlug || 'agendar';
  const publicLink = `${window.location.origin}/${currentSlug}`;

  // Helper para converter data do Firestore com segurança
  const safeToDate = (dateObj) => {
    if (!dateObj) return new Date();
    if (dateObj.toDate) return dateObj.toDate();
    return new Date(dateObj);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      alert('Link copiado!');
    } catch (error) {
      alert('Não foi possível copiar o link.');
    }
  };

  const handleUploadLogo = async (file) => {
    if (!file || !establishment?.id) return;
    try {
      setLogoUploading(true);
      const filePath = `establishments/${establishment.id}/logo-${Date.now()}`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'establishments', establishment.id), { logo_url: url });
      setProfileInfo(prev => ({ ...prev, logo_url: url }));
      alert('Logo atualizada!');
    } catch (error) {
      console.error('Erro ao enviar logo:', error);
      alert('Não foi possível enviar a logo. Verifique o Firebase Storage.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadPhoto = async (file) => {
    if (!file || !user?.uid) return;
    try {
      setPhotoUploading(true);
      const filePath = `users/${user.uid}/profile-${Date.now()}`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfileInfo(prev => ({ ...prev, photoURL: url }));
      alert('Foto de perfil atualizada!');
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      alert('Não foi possível enviar a foto. Verifique o Firebase Storage.');
    } finally {
      setPhotoUploading(false);
    }
  };

  if (loading || !user || (user.tipo === 'admin' && !establishment)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
        <p className="text-pink-600 font-medium">Carregando painel de controle...</p>
      </div>
    );
  }

  // Se o perfil estiver incompleto, exibe o OnboardingWizard
  if (isProfileIncomplete) {
    return <OnboardingWizard establishment={establishment} />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50">
      
      {/* Sidebar Desktop (Fixa) */}
      <aside className="hidden md:block w-72 bg-white border-r border-pink-100 sticky top-0 h-screen overflow-hidden shrink-0">
        <SidebarContent 
          view={view} 
          setView={setView} 
          logout={logout} 
          establishment={establishment}
          profileInfo={profileInfo}
        />
      </aside>

      {/* Navegação Mobile */}
      <MobileTopbar 
        onMenuClick={() => setIsMenuOpen(true)} 
        title="Bellizy" 
      />
      
      <MobileDrawer 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
        view={view}
        setView={setView}
        logout={logout}
        establishment={establishment}
        profileInfo={profileInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 pb-12 md:pb-10 max-w-6xl mx-auto w-full overflow-y-auto">
        
        {/* VIEW: OVERVIEW */}
        {view === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Boas vindas simplificado */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Olá, {establishment?.nome}! 👋</h2>
                <p className="text-sm text-gray-500 font-medium">Veja o que temos para agora.</p>
              </div>
              <div className="hidden md:block">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">A</div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">B</div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">C</div>
                </div>
              </div>
            </div>

            {/* Card do Link de Agendamento */}
            <div className="bg-gradient-to-r from-pink-600 to-rose-500 p-6 rounded-[2.5rem] text-white shadow-xl shadow-pink-200">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                  Seu Link de Agendamento
                </span>
                <CalendarCheck size={24} className="opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-3">Compartilhe para receber agendamentos:</p>
              <div className="flex gap-2">
                <input 
                  readOnly 
                  value={publicLink}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm outline-none backdrop-blur-sm truncate"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(publicLink);
                    alert("Link copiado!");
                  }}
                  className="bg-white text-pink-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-pink-50 transition-colors"
                >
                  Copiar
                </button>
              </div>
            </div>

            {/* Próximo da Agenda - Painel Inteligente */}
            <NextAppointmentSection appointments={allAppointments} />
          </div>
        )}

        {/* VIEW: FINANCAS */}
        {view === 'financas' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Finanças</h2>
              <p className="text-gray-500 font-medium">Controle seu faturamento e desempenho.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Faturamento Hoje</p>
                  <h3 className="text-2xl font-black text-gray-800">R$ {dailyRevenue}</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <CalendarCheck size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sessões Hoje</p>
                  <h3 className="text-2xl font-black text-gray-800">{totalServices} sessões</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Acumulado</p>
                  <h3 className="text-2xl font-black text-gray-800">R$ {totalGlobalRevenue}</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total de Agendamentos</p>
                  <h3 className="text-2xl font-black text-gray-800">{totalGlobalApps}</h3>
                </div>
              </div>
            </div>

            {/* Placeholder para histórico financeiro futuro */}
            <div className="bg-pink-50/30 border border-dashed border-pink-200 p-10 rounded-[2.5rem] text-center">
              <p className="text-pink-400 font-bold">Em breve: Relatórios detalhados e gráficos de desempenho.</p>
            </div>
          </div>
        )}

        {/* VIEW: CLIENTES */}
        {view === 'clientes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Clientes</h2>
              <p className="text-gray-500 font-medium">Gestão da sua base de clientes.</p>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                <Users size={40} />
              </div>
              <p className="text-gray-400 font-medium">Módulo de Gestão de Clientes em desenvolvimento.</p>
              <p className="text-xs text-gray-300 mt-2">Em breve você poderá ver o histórico completo de cada cliente aqui!</p>
            </div>
          </div>
        )}

        {/* VIEW: AGENDA */}
        {view === 'agenda' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Toggle Visualização */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-pink-100 w-fit mx-auto shadow-sm">
              <button 
                onClick={() => setAgendaView('list')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  agendaView === 'list' ? 'bg-pink-600 text-white shadow-md shadow-pink-100' : 'text-gray-400 hover:text-pink-600'
                }`}
              >
                Lista
              </button>
              <button 
                onClick={() => setAgendaView('calendar')}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  agendaView === 'calendar' ? 'bg-pink-600 text-white shadow-md shadow-pink-100' : 'text-gray-400 hover:text-pink-600'
                }`}
              >
                Calendário
              </button>
            </div>

            {agendaView === 'list' ? (
              <>
                <div className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex items-center justify-between">
                  <button 
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setSelectedDate(newDate);
                    }}
                    className="p-2 hover:bg-pink-50 rounded-full transition-colors text-pink-600"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800">
                      {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </h3>
                    <p className="text-xs text-pink-600 font-bold uppercase tracking-widest">
                      {format(selectedDate, "EEEE", { locale: ptBR })}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setSelectedDate(newDate);
                    }}
                    className="p-2 hover:bg-pink-50 rounded-full transition-colors text-pink-600"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {appointments.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-pink-100">
                      <Calendar size={48} className="mx-auto text-pink-100 mb-4" />
                      <p className="text-gray-400">Nenhum agendamento nesta data.</p>
                    </div>
                  ) : (
                    appointments.map(app => (
                      <div key={app.id} className={`bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-2 shadow-sm transition-all ${
                        (app.status === 'cancelado' || app.status === 'cancelled') ? 'opacity-50 grayscale border-gray-100' : 'border-pink-50'
                      }`}>
                        <div className="flex justify-between items-center">
                          <div className="flex gap-3 sm:gap-6 items-center">
                            <div className="text-center min-w-[60px] sm:min-w-[70px] border-r border-pink-100 pr-3 sm:pr-6">
                              <span className="block text-xl sm:text-2xl font-black text-pink-600">{format(safeToDate(app.data_hora), "HH:mm")}</span>
                              <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{app.duration} MIN</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-gray-800">{app.user_nome}</h3>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  (app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado') ? 'bg-green-100 text-green-700' : 
                                  app.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {app.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 flex items-center gap-1 font-medium">
                                <Sparkles size={14} className="text-pink-400" /> {app.service_nome}
                              </p>
                            </div>
                          </div>
                          {(app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado') && (
                            <button 
                              onClick={() => handleCancelAppointment(app.id)} 
                              className="p-3 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-2xl transition-all"
                            >
                              <X size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="animate-in zoom-in-95 duration-300">
                <AppointmentCalendar 
                  appointments={allAppointments} 
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    setSelectedDate(date);
                    setAgendaView('list');
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW: HORARIOS */}
        {view === 'horarios' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Gerenciar Horários</h2>
                <p className="text-gray-500 font-medium">Controle sua agenda semanal e bloqueios pontuais.</p>
              </div>
              <button 
                onClick={() => setShowWeeklyEditor(!showWeeklyEditor)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-pink-100 text-pink-600 rounded-2xl font-bold hover:bg-pink-50 transition-all shadow-sm shadow-pink-100"
              >
                <Calendar size={20} />
                <span>{showWeeklyEditor ? 'Voltar para Calendário' : 'Escala Semanal'}</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {showWeeklyEditor ? (
                <motion.div 
                  key="weekly"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-pink-100 shadow-sm"
                >
                  <WeeklyAvailabilityEditor 
                    establishment={establishment} 
                    onSave={() => setShowWeeklyEditor(false)}
                  />
                </motion.div>
              ) : (
                <motion.div 
                  key="calendar"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-pink-100 shadow-sm"
                >
                  <AvailabilityCalendar establishment={establishment} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* VIEW: SERVICOS */}
        {view === 'servicos' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <form onSubmit={handleSaveService} className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-pink-100 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nome</label>
                  <input 
                    type="text" placeholder="Ex: Limpeza de Pele" required
                    value={newService.nome} onChange={e => setNewService({...newService, nome: e.target.value})}
                    className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Descricao</label>
                    <span className="text-[10px] font-bold text-gray-400">
                      {newService.descricao.length}/{SERVICE_DESCRIPTION_LIMIT}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={SERVICE_DESCRIPTION_LIMIT}
                    placeholder="Descreva rapidamente o servico para a cliente."
                    value={newService.descricao}
                    onChange={e => setNewService({...newService, descricao: e.target.value})}
                    className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all text-sm sm:text-base resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Duração</label>
                    <input 
                      type="number" placeholder="Minutos" required
                      value={newService.duracao} onChange={e => setNewService({...newService, duracao: e.target.value})}
                      className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Preço</label>
                    <input 
                      type="number" placeholder="R$" required
                      value={newService.preco} onChange={e => setNewService({...newService, preco: e.target.value})}
                      className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" className="w-full bg-pink-600 text-white py-3 sm:py-4 rounded-2xl font-bold hover:bg-pink-700 shadow-lg shadow-pink-100 transition-all active:scale-95 text-sm sm:text-base">
                  {editingServiceId ? 'Atualizar Serviço' : 'Salvar Serviço'}
                </button>
                {editingServiceId && (
                  <button
                    type="button"
                    onClick={resetServiceForm}
                    className="w-full sm:w-auto px-6 py-3 sm:py-4 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all text-sm sm:text-base"
                  >
                    Cancelar edicao
                  </button>
                )}
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map(s => (
                <div key={s.id} className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-pink-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                  <div>
                    <h4 className="font-bold text-gray-800 text-base sm:text-lg">{s.nome}</h4>
                    {s.descricao && (
                      <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-5 max-w-[240px]">
                        {s.descricao}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-2 mt-1">
                      <Clock size={14} className="text-pink-400" /> {s.duracao} min 
                      <span className="w-1 h-1 bg-pink-200 rounded-full"></span>
                      <span className="text-pink-600 font-bold">R$ {s.preco}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditService(s)}
                      className="p-2 sm:p-3 text-gray-300 hover:text-pink-600 hover:bg-pink-50 rounded-2xl transition-all"
                      title="Editar serviço"
                    >
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDeleteService(s.id)} className="p-2 sm:p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                      <Trash2 size={18} sm:size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: CONFIG */}
        {view === 'config' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <form onSubmit={saveSettings} className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-pink-100 shadow-sm space-y-8">
              
              {/* Link da Estética */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <LinkIcon size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Seu Link Único</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Este é o endereço que suas clientes usarão para agendar.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-400">{window.location.host}/</p>
                      <p className="text-[11px] text-gray-400 truncate">{publicLink}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="shrink-0 px-3 py-2 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors text-[10px] font-black uppercase tracking-widest border border-pink-100"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="relative group">
                    <input 
                      type="text"
                      required
                      value={tempSlug}
                      onChange={e => {
                        const raw = e.target.value || '';
                        const lastPart = raw.includes('/') ? raw.split('/').filter(Boolean).pop() || '' : raw;
                        setTempSlug(sanitizeSlug(lastPart));
                      }}
                      className={`w-full pl-4 pr-12 py-3 sm:py-4 bg-pink-50/50 border-2 rounded-2xl outline-none transition-all font-bold text-gray-700 text-sm sm:text-base ${
                        slugStatus.checking 
                          ? 'border-gray-200' 
                          : !slugStatus.available
                            ? 'border-red-300 focus:border-red-400'
                            : isSlugDirty
                              ? 'border-rose-300 focus:border-rose-400'
                              : 'border-transparent focus:border-pink-300'
                      }`}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {slugSaving ? (
                        <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                      ) : slugStatus.checking ? (
                        <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                      ) : !isSlugDirty || slugSaved ? (
                        <CheckCircle className="text-green-500" size={20} />
                      ) : (
                        <AlertCircle className="text-rose-500" size={20} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-2">
                    <p className="text-[11px] text-gray-400">Dica: use um nome curto e fácil de lembrar.</p>
                    <button
                      type="button"
                      onClick={handleSaveSlug}
                      disabled={slugSaving || slugStatus.checking || !slugStatus.available || !isSlugDirty}
                      className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
                        slugSaved || !isSlugDirty
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      {slugSaving ? 'Salvando...' : slugSaved || !isSlugDirty ? 'Salvo' : 'Salvar'}
                    </button>
                  </div>
                  {slugStatus.message && (
                    <p className={`text-xs font-bold ml-2 ${slugStatus.available ? 'text-green-600' : 'text-red-500'}`}>
                      {slugStatus.message}
                    </p>
                  )}
                </div>
              </div>

              <hr className="border-slate-950/30" />

              {/* Logo and Social */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <ImageIcon size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Identidade Visual</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Logo e redes sociais da estética.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3 sm:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Logo da Estética</label>
                    <div className="bg-pink-50/50 border-2 border-transparent rounded-[2rem] p-4 sm:p-5">
                      <label htmlFor="logo-upload" className="w-full flex items-center justify-center cursor-pointer">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-pink-100 overflow-hidden flex items-center justify-center shrink-0 relative">
                          {profileInfo.logo_url ? (
                            <img src={profileInfo.logo_url} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl sm:text-4xl font-black text-pink-400">+</span>
                          )}
                          {logoUploading && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </label>

                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadLogo(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Instagram (@perfil)</label>
                    <div className="relative">
                      <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                      <input
                        type="text"
                        value={profileInfo.instagram}
                        onChange={e => setProfileInfo({ ...profileInfo, instagram: e.target.value.replace(/\s+/g, '') })}
                        className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-950/30" />

              {/* Informações do Perfil */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <User size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Perfil Profissional</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Estas informações aparecem para seus clientes.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Sua Foto de Perfil</label>
                    <div className="bg-pink-50/50 border-2 border-transparent rounded-[2rem] p-4 sm:p-5 flex items-center gap-6">
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border border-pink-100 overflow-hidden flex items-center justify-center shrink-0 relative shadow-md">
                          {profileInfo.photoURL ? (
                            <img src={profileInfo.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                          ) : (
                            <User size={40} className="text-pink-200" />
                          )}
                          {photoUploading && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </label>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-bold text-gray-700">Sua foto profissional</p>
                        <p className="text-xs text-gray-500">Essa foto aparecerá para suas clientes e no seu menu lateral.</p>
                        <label htmlFor="photo-upload" className="inline-block text-[10px] font-black uppercase tracking-widest bg-slate-950 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-slate-800 transition-all">
                          Alterar Foto
                        </label>
                      </div>

                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadPhoto(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nome da Estética</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                      <input 
                        type="text"
                        required
                        value={profileInfo.nome}
                        onChange={e => setProfileInfo({...profileInfo, nome: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">Endereço Completo</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                      <input 
                        type="text"
                        required
                        value={profileInfo.endereco}
                        onChange={e => setProfileInfo({...profileInfo, endereco: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-2">WhatsApp / Contato</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                      <input 
                        type="tel"
                        required
                        value={profileInfo.telefone}
                        onChange={e => setProfileInfo({...profileInfo, telefone: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 ml-2">Esse numero sera usado no botao "Conversar no WhatsApp" da cliente.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-2">Descricao</label>
                      <span className="text-[10px] font-bold text-gray-400">
                        {profileInfo.descricao.length}/{DESCRIPTION_LIMIT}
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      maxLength={DESCRIPTION_LIMIT}
                      value={profileInfo.descricao}
                      onChange={e => setProfileInfo({...profileInfo, descricao: e.target.value})}
                      className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-medium text-gray-700 text-sm sm:text-base resize-none"
                    />
                  </div>

                </div>
              </div>

              <hr className="border-pink-50" />

              {/* Política de Cancelamento */}
              <div className="bg-pink-50/30 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-slate-950/30">
                <button
                  type="button"
                  onClick={() => setIsPolicyOpen(v => !v)}
                  className="w-full flex items-center justify-between p-6 sm:p-8 text-left"
                >
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Política de Cancelamento</h3>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {isPolicyOpen ? 'Ajuste as regras de cancelamento e atraso.' : 'Toque para configurar.'}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-2xl bg-white/70 text-gray-500 flex items-center justify-center transition-transform ${isPolicyOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={18} />
                  </div>
                </button>

                {isPolicyOpen && (
                  <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                    <CancellationPolicySettings establishment={establishment} />
                  </div>
                )}
              </div>

              <button type="submit" className="w-full bg-slate-950 text-white py-3 sm:py-4 rounded-2xl font-bold hover:bg-slate-800 shadow-lg transition-all active:scale-95 text-sm sm:text-base">
                Salvar Informações do Perfil
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
