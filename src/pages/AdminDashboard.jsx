import { useState, useEffect, useMemo } from 'react';
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
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadToSupabase } from '../services/supabase';
import { format, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { maskPhone, validatePhone } from '../utils/formatters';
import { 
  Plus, 
  Pencil,
  Trash2, 
  Star,
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
  Smartphone,
  LogOut,
  Instagram,
  Image as ImageIcon,
  Shield,
  ShieldAlert,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Crown,
  Zap,
  Check,
  MessageCircleMore,
  ChevronDown,
  ChevronUp,
  Mail,
  Info,
  Lock,
  Bell
} from 'lucide-react';
import { isSlugAvailable, sanitizeSlug } from '../services/establishmentService';
import OnboardingWizard from '../components/admin/onboarding/OnboardingWizard';
import WeeklyAvailabilityEditor from '../components/admin/settings/WeeklyAvailabilityEditor';
import CancellationPolicySettings from '../components/admin/settings/CancellationPolicySettings';
import AvailabilityCalendar from '../components/admin/settings/AvailabilityCalendar';
import NextAppointmentSection from '../components/admin/dashboard/NextAppointmentSection';
import AppointmentCalendar from '../components/admin/dashboard/AppointmentCalendar';
import SidebarContent from '../components/admin/dashboard/SidebarContent';
import AppointmentDetailsModal from '../components/admin/dashboard/AppointmentDetailsModal';
import { MobileTopbar, MobileDrawer } from '../components/admin/dashboard/MobileNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LAYOUTS, PALETTES, DEFAULT_SETTINGS } from '../components/client/minisite/registry';
import MiniSiteRenderer from '../components/client/minisite/MiniSiteRenderer';

const DESCRIPTION_LIMIT = 140;
const POLICY_LIMIT = 220;
const SERVICE_DESCRIPTION_LIMIT = 160;

// Helper para converter data do Firestore com segurança
const safeToDate = (dateObj) => {
  if (!dateObj) return new Date();
  if (dateObj.toDate) return dateObj.toDate();
  return new Date(dateObj);
};

const createPseudoTimestamp = (ms) => ({
  toMillis: () => ms,
  toDate: () => new Date(ms)
});

// Helper para formatar telefone
const formatPhone = (phone) => {
  if (!phone) return 'Não informado';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  return phone;
};

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ nome: '', telefone: '' });
  const [manualClients, setManualClients] = useState([]);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('detalhes'); // 'detalhes' ou 'historico'
  const [visibleClientsCount, setVisibleClientsCount] = useState(10);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isAppDetailsModalOpen, setIsAppDetailsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState({ id: null, text: '' });
  const [openConfigSection, setOpenConfigSection] = useState('link'); // 'link', 'visual', 'perfil'
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenReminderIds, setSeenReminderIds] = useState([]);

  // Lógica de Permissões por Plano
  const userPlan = establishment?.plan || establishment?.subscription?.plan || 'bronze'; // bronze, silver, gold
  
  const hasAccess = (feature) => {
    const permissions = {
      'financas': ['silver', 'gold'],
      'multiprofissional': ['gold'],
      'customizacao_avancada': ['silver', 'gold'],
      'agendamentos_ilimitados': ['silver', 'gold']
    };
    return permissions[feature]?.includes(userPlan) ?? true;
  };

  useEffect(() => {
    if (!establishment?.id) return;
    try {
      const raw = localStorage.getItem(`seen_admin_reminders_${establishment.id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setSeenReminderIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSeenReminderIds([]);
    }
  }, [establishment?.id]);

  const autoReminderNotifications = useMemo(() => {
    const nowMs = Date.now();
    const seen = new Set(seenReminderIds);
    const reminders = [];

    allAppointments.forEach((app) => {
      const status = app.status;
      if (status === 'cancelled' || status === 'cancelado' || status === 'completed') return;

      const start = safeToDate(app.start_time || app.data_hora);
      const startMs = start.getTime();
      if (!Number.isFinite(startMs)) return;

      const diffMs = startMs - nowMs;
      if (diffMs <= 0) return;
      if (diffMs > 24 * 60 * 60 * 1000) return;

      const id = `auto-24h-${app.id}`;
      if (seen.has(id)) return;

      const servicesLabel =
        app.services && Array.isArray(app.services) && app.services.length > 0
          ? app.services.map((s) => s.nome || s.name).filter(Boolean).join(' + ')
          : app.service_nome || 'Serviço';

      reminders.push({
        id,
        type: 'reminder_24h',
        title: 'Lembrete: atendimento nas próximas 24h',
        message: `${app.user_nome || 'Cliente'} • ${servicesLabel} • ${format(start, "dd/MM 'às' HH:mm")}`,
        read: false,
        createdAt: createPseudoTimestamp(startMs - 24 * 60 * 60 * 1000)
      });
    });

    reminders.sort((a, b) => {
      const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });

    return reminders.slice(0, 8);
  }, [allAppointments, seenReminderIds]);

  const uiNotifications = useMemo(() => {
    const merged = [...autoReminderNotifications, ...notifications];
    merged.sort((a, b) => {
      const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return dateB - dateA;
    });
    return merged;
  }, [autoReminderNotifications, notifications]);

  const hasUnreadUiNotifications = uiNotifications.some((n) => !n.read);

  const markAutoRemindersSeen = () => {
    if (!establishment?.id) return;
    if (autoReminderNotifications.length === 0) return;

    const ids = autoReminderNotifications.map((n) => n.id);
    setSeenReminderIds((prev) => {
      const next = Array.from(new Set([...(prev || []), ...ids]));
      try {
        localStorage.setItem(`seen_admin_reminders_${establishment.id}`, JSON.stringify(next));
      } catch {
      }
      return next;
    });
  };

  // Contagem de agendamentos do mês atual
  const monthlyAppointmentsCount = useMemo(() => {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    return allAppointments.filter(app => {
      const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
      return appDate >= startOfCurrentMonth && appDate <= endOfCurrentMonth && app.status !== 'cancelled';
    }).length;
  }, [allAppointments]);

  const isLimitReached = userPlan === 'bronze' && monthlyAppointmentsCount >= 100;
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, client: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Helper para mostrar notificações
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Lógica de Assinatura e Planos
  const subscription = establishment?.subscription || { status: 'trial', trial_ends_at: null };
  const trialEndsAt = safeToDate(subscription.trial_ends_at);
  const isTrialExpired = subscription.status === 'trial' && new Date() > trialEndsAt;
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24)));

  const PLANS = [
    {
      id: 'bronze',
      name: 'Essencial',
      price: '19,99',
      icon: Zap,
      color: 'blue',
      features: ['Até 100 agendamentos/mês', 'Gestão de Clientes', 'WhatsApp Flutuante', 'Suporte via Chat']
    },
    {
      id: 'silver',
      name: 'Profissional',
      price: '29,99',
      icon: Crown,
      color: 'pink',
      popular: true,
      features: ['Agendamentos Ilimitados', 'Relatórios Financeiros', 'Personalização Completa', 'Suporte Prioritário']
    },
    {
      id: 'gold',
      name: 'Premium VIP',
      price: '44,99',
      icon: Sparkles,
      color: 'amber',
      features: ['Tudo do Profissional', 'Multiprofissionais', 'Estatísticas Avançadas', 'Treinamento VIP']
    }
  ];

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
    professionalName: '', // Novo campo para Marca Pessoal
    banner_url: '',
    instagram: '',
    horario_funcionamento: '',
    politica_cancelamento: ''
  });
  const [minisiteSettings, setMinisiteSettings] = useState(DEFAULT_SETTINGS);
  const [openSection, setOpenSection] = useState(null); // Todas as abas começam fechadas
  const [showMobilePreview, setShowMobilePreview] = useState(false); // Modal de prévia mobile

  useEffect(() => {
    if (establishment) {
      setProfileInfo({
        nome: establishment.nome || establishment.name || '',
        endereco: establishment.endereco || establishment.address || '',
        telefone: establishment.telefone || establishment.phone || '',
        descricao: establishment.descricao || '',
        logo_url: establishment.logo_url || '',
        photoURL: user?.photoURL || establishment.photoURL || '',
        professionalName: establishment.professionalName || '', // Carrega do DB
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
      setMinisiteSettings(establishment.minisite_settings || DEFAULT_SETTINGS);
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
      console.error("Erro na escuta de agendamentos:", error);
    });

    return () => unsubscribe();
  }, [establishment?.id]);

  // ESCUTA EM TEMPO REAL: Monitora clientes cadastrados manualmente
  useEffect(() => {
    if (!establishment?.id) return;

    const q = query(
      collection(db, "manual_clients"),
      where("establishment_id", "==", establishment.id)
      // Removido orderBy para evitar erro de índice no Firebase
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setManualClients(clients);
    }, (error) => {
      console.error("Erro na escuta de clientes manuais:", error);
    });

    return () => unsubscribe();
  }, [establishment?.id]);

  // ESCUTA EM TEMPO REAL: Notificações
  useEffect(() => {
    if (!establishment?.id) return;

    const q = query(
      collection(db, "notifications"),
      where("establishment_id", "==", establishment.id)
      // Removido orderBy temporariamente para evitar erro de índice
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenação manual no cliente enquanto o índice é criado no Firebase
      notifs.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      setNotifications(notifs);
    }, (error) => {
      console.error("Erro na escuta de notificações:", error);
      // Se o erro for de índice, mostramos uma mensagem amigável no console
      if (error.code === 'failed-precondition') {
        console.warn("O sistema de notificações requer um índice no Firebase. Clique no link do erro acima para criar.");
      }
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
      setIsServiceModalOpen(false);
      showToast(editingServiceId ? "Serviço atualizado com sucesso!" : "Serviço adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar serviço:", error);
      showToast("Erro ao salvar serviço.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteService(id) {
    if (!window.confirm("Excluir serviço?")) return;
    try {
      await deleteDoc(doc(db, "services", id));
      showToast("Serviço excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      showToast("Erro ao excluir serviço.", "error");
    }
  }

  function handleEditService(service) {
    setEditingServiceId(service.id);
    setNewService({
      nome: service.nome || '',
      descricao: service.descricao || '',
      duracao: service.duracao || 30,
      preco: service.preco || ''
    });
    setIsServiceModalOpen(true);
  }

  function resetServiceForm() {
    setEditingServiceId(null);
    setNewService({ nome: '', descricao: '', duracao: 30, preco: '' });
    setIsServiceModalOpen(false);
  }

  async function handleCancelAppointment(id) {
    try {
      setLoading(true);
      const appRef = doc(db, "appointments", id);
      const appSnap = await getDoc(appRef);
      const appData = appSnap.exists() ? appSnap.data() : null;

      await updateDoc(appRef, { status: 'cancelled' });

      // Notificação para o cliente
      if (appData?.user_id) {
        await addDoc(collection(db, "notifications"), {
          establishment_id: establishment.id,
          user_id: appData.user_id,
          type: 'appointment_cancelled',
          title: 'Agendamento Cancelado',
          message: `Seu agendamento para ${appData.service_nome || 'Serviço'} foi cancelado pela estética.`,
          read: false,
          createdAt: Timestamp.now()
        });
        
        // NOVO: Força um pequeno delay para garantir que o Firestore processe antes do toast
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setIsAppDetailsModalOpen(false);
      showToast("Agendamento cancelado.");
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      showToast("Erro ao cancelar agendamento.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteAppointment(id) {
    try {
      setLoading(true);
      const appRef = doc(db, "appointments", id);
      const appSnap = await getDoc(appRef);
      const appData = appSnap.exists() ? appSnap.data() : null;

      await updateDoc(appRef, { status: 'completed' });

      // Notificação para o cliente
      if (appData?.user_id) {
        await addDoc(collection(db, "notifications"), {
          establishment_id: establishment.id,
          user_id: appData.user_id,
          type: 'appointment_completed',
          title: 'Atendimento Finalizado! ✨',
          message: `Sua sessão de ${appData.service_nome || 'Serviço'} foi concluída. Esperamos que tenha amado!`,
          read: false,
          createdAt: Timestamp.now()
        });
      }

      setIsAppDetailsModalOpen(false);
      showToast("Agendamento finalizado!");
    } catch (error) {
      console.error("Erro ao finalizar agendamento:", error);
      showToast("Erro ao finalizar.", "error");
    } finally {
      setLoading(false);
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
    if (!validatePhone(profileInfo.telefone)) {
      showToast("Por favor, insira um WhatsApp válido com DDD.", "error");
      return;
    }
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
        instagram: profileInfo.instagram,
        professionalName: profileInfo.professionalName
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

      showToast("Configurações salvas!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      showToast("Erro ao salvar configurações.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveMinisiteSettings() {
    if (!establishment?.id) return;
    try {
      setLoading(true);
      // Salva tanto as configurações do minisite quanto o nome profissional e foto no estabelecimento
      await updateDoc(doc(db, 'establishments', establishment.id), {
        minisite_settings: minisiteSettings,
        professionalName: profileInfo.professionalName, // Salva o nome da profissional
        photoURL: profileInfo.photoURL, // Garante que a foto profissional esteja no estabelecimento
        logo_url: profileInfo.logo_url // Garante que a logo também esteja sincronizada
      });
      showToast("Visual do site atualizado!");
    } catch (error) {
      console.error("Erro ao salvar visual do site:", error);
      showToast("Erro ao salvar visual.", "error");
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

  // Processamento da Lista de Clientes
  const clientsList = useMemo(() => {
    const clientsMap = {};

    // 1. Processa clientes que já fizeram agendamentos
    allAppointments.forEach(app => {
      // Ignora clientes que foram marcados como ocultos
      if (app.hidden_from_list) return;

      // Mapeamento robusto de campos (Firebase pode ter variações de versões anteriores)
      const nome = app.user_nome || app.userName || app.userNome || 'Cliente sem nome';
      const telefone = app.user_telefone || app.user_phone || app.userPhone || app.userTelefone || '';
      const email = app.user_email || app.userEmail || app.userEmailAddress || '';
      const photoURL = app.user_avatar || app.userPhoto || app.userPhotoURL || '';

      // Tenta usar o UID do usuário, se não tiver usa e-mail ou telefone para agrupar
      const clientId = app.user_id || app.user_uid || email || telefone || nome;
      if (!clientId) return;

      if (!clientsMap[clientId]) {
        clientsMap[clientId] = {
          uid: clientId,
          real_uid: app.user_id || app.user_uid || null,
          nome,
          telefone,
          email,
          photoURL,
          totalAppointments: 0,
          totalSpent: 0,
          lastVisit: null,
          appointments: [],
          type: 'automatic',
          notes: app.user_notes || ''
        };
      }

      clientsMap[clientId].totalAppointments += 1;
      clientsMap[clientId].totalSpent += Number(app.total_price || app.preco || 0);
      clientsMap[clientId].appointments.push(app);

      const appDate = safeToDate(app.data_hora);
      if (!clientsMap[clientId].lastVisit || appDate > clientsMap[clientId].lastVisit) {
        clientsMap[clientId].lastVisit = appDate;
      }
    });

    // 2. Adiciona clientes cadastrados manualmente
    manualClients.forEach(manual => {
      const clientId = manual.id;
      if (!clientsMap[clientId]) {
        clientsMap[clientId] = {
          uid: clientId,
          real_uid: null,
          nome: manual.nome || 'Cliente sem nome',
          telefone: manual.telefone || '',
          email: manual.email || '',
          photoURL: '',
          totalAppointments: 0,
          totalSpent: 0,
          lastVisit: manual.lastVisit ? safeToDate(manual.lastVisit) : null,
          appointments: [],
          type: 'manual',
          notes: manual.notes || ''
        };
      }
    });

    return Object.values(clientsMap)
      .sort((a, b) => {
        if (a.lastVisit && b.lastVisit) return b.lastVisit - a.lastVisit;
        if (a.lastVisit) return -1;
        if (b.lastVisit) return 1;
        return a.nome.localeCompare(b.nome);
      })
      .filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allAppointments, manualClients, searchTerm]);

  const currentSlug = establishment?.slug || tempSlug || 'agendar';
  const publicLink = `${window.location.origin}/${currentSlug}`;

  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setIsCopied(true);
      showToast('Link copiado com sucesso!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      showToast('Não foi possível copiar.', 'error');
    }
  };

  const handleUploadLogo = async (file) => {
    if (!file || !establishment?.id) return;
    try {
      setLogoUploading(true);
      const filePath = `establishments/${establishment.id}/logo-${Date.now()}`;
      const url = await uploadToSupabase(file, 'bellizyuplo', filePath);
      await updateDoc(doc(db, 'establishments', establishment.id), { logo_url: url });
      setProfileInfo(prev => ({ ...prev, logo_url: url }));
      showToast('Logo atualizada!');
    } catch (error) {
      console.error('Erro ao enviar logo:', error);
      showToast('Erro no Supabase.', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadPhoto = async (file) => {
    if (!file || !user?.uid) return;
    try {
      setPhotoUploading(true);
      const filePath = `users/${user.uid}/profile-${Date.now()}`;
      const url = await uploadToSupabase(file, 'bellizyuplo', filePath);
      
      // Atualiza o documento do usuário
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      
      // NOVO: Também atualiza o documento do estabelecimento para o Mini Site
      if (establishment?.id) {
        await updateDoc(doc(db, 'establishments', establishment.id), { photoURL: url });
      }
      
      setProfileInfo(prev => ({ ...prev, photoURL: url }));
      showToast('Foto de perfil atualizada!');
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      showToast('Erro no Supabase.', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleAddManualClient = async (e) => {
    e.preventDefault();
    if (!newClient.nome || !newClient.telefone) {
      showToast("Nome e Telefone são obrigatórios!", "error");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "manual_clients"), {
        ...newClient,
        establishment_id: establishment.id,
        createdAt: Timestamp.now(),
        lastVisit: Timestamp.now() // Define a data de agora para que apareça como Ativa
      });
      setNewClient({ nome: '', telefone: '' });
      setIsClientModalOpen(false);
      showToast("Cliente cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao cadastrar cliente:", error);
      showToast("Erro ao cadastrar cliente.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (client) => {
    if (!client || !editingNote.id) return;
    
    try {
      setIsSavingNote(true);
      
      if (client.type === 'manual') {
        // Salva em manual_clients
        await updateDoc(doc(db, "manual_clients", client.uid), {
          notes: editingNote.text
        });
      } else {
        // Para clientes automáticos (com ou sem real_uid), 
        // salvamos a nota em todos os agendamentos dele para este estabelecimento.
        // Isso garante que o dashboard (que ouve agendamentos) atualize em tempo real.
        const batch = writeBatch(db);
        client.appointments.forEach(app => {
          batch.update(doc(db, "appointments", app.id), { user_notes: editingNote.text });
        });
        
        // Se ele tiver um UID real, também salvamos no perfil dele para ficar guardado globalmente
        if (client.real_uid) {
          batch.update(doc(db, "users", client.real_uid), { user_notes: editingNote.text });
        }
        
        await batch.commit();
      }
      
      setEditingNote({ id: null, text: '' });
      showToast("Observação salva!");
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      showToast("Erro ao salvar.", "error");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteClient = async () => {
    const client = deleteConfirmModal.client;
    if (!client) return;

    try {
      setLoading(true);
      if (client.type === 'manual') {
        await deleteDoc(doc(db, "manual_clients", client.uid));
      } else {
        const batch = writeBatch(db);
        client.appointments.forEach(app => {
          batch.update(doc(db, "appointments", app.id), { hidden_from_list: true });
        });
        await batch.commit();
      }
      setDeleteConfirmModal({ open: false, client: null });
      showToast("Cliente removida com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      showToast("Erro ao excluir cliente.", "error");
    } finally {
      setLoading(false);
    }
  };

  async function handleMarkAllNotificationsRead() {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Erro ao marcar notificações:", error);
    }
  }

  if (loading || !user || (user.tipo === 'admin' && !establishment)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
        <p className="text-pink-600 font-medium italic animate-pulse">Bellizy...</p>
      </div>
    );
  }

  // Componente de Bloqueio por Plano
  const UpgradeRequired = ({ feature }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in zoom-in-95">
      <div className="w-24 h-24 bg-pink-50 text-pink-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-pink-100">
        <Lock size={48} />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Recurso Premium</h3>
        <p className="text-gray-500 font-medium">
          O módulo de {feature} está disponível apenas nos planos <strong>Profissional</strong> e <strong>Premium VIP</strong>.
        </p>
      </div>
      <button 
        onClick={() => setView('assinatura')}
        className="bg-pink-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95"
      >
        Ver Planos de Assinatura
      </button>
    </div>
  );

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
        onNotificationsClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) {
            markAutoRemindersSeen();
            handleMarkAllNotificationsRead();
          }
        }}
        hasUnreadNotifications={hasUnreadUiNotifications}
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
      <main className="flex-1 p-4 md:p-10 pb-12 md:pb-10 max-w-6xl mx-auto w-full overflow-y-auto relative">
        
        {/* Top Header Barra de Ações (Sininho, Perfil, etc) */}
        <div className="flex items-center justify-between mb-8 hidden md:flex">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 md:hidden">
              <Store size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase md:hidden">Bellizy</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Central de Notificações */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    markAutoRemindersSeen();
                    handleMarkAllNotificationsRead();
                  }
                }}
                className={`p-3 rounded-2xl transition-all ${showNotifications ? 'bg-pink-100 text-pink-600' : 'bg-white text-gray-400 hover:bg-pink-50 hover:text-pink-600 shadow-sm border border-gray-100'}`}
              >
                <Bell size={20} fill={hasUnreadUiNotifications ? "currentColor" : "none"} />
                {hasUnreadUiNotifications && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
              
              {/* Dropdown Notificações Desktop */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-pink-50 z-50 overflow-hidden hidden sm:block"
                    >
                      <div className="p-4 bg-pink-50/50 border-b border-pink-50 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-pink-600">Notificações</span>
                        <span className="text-[10px] font-bold text-gray-400">{uiNotifications.length} mensagens</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto scrollbar-hide">
                        {uiNotifications.length === 0 ? (
                          <div className="p-10 text-center space-y-2">
                            <Sparkles className="mx-auto text-pink-200" size={32} />
                            <p className="text-xs font-bold text-gray-400">Tudo limpo por aqui!</p>
                          </div>
                        ) : (
                          uiNotifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              className={`p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!notif.read ? 'bg-pink-50/20' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'new_appointment' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {notif.type === 'new_appointment' ? <CalendarCheck size={16} /> : <Info size={16} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-800 leading-tight mb-1">{notif.title}</p>
                                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{notif.message}</p>
                                  <p className="text-[9px] text-gray-400 mt-2 font-medium">
                                    {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), "HH:mm '·' dd/MM") : 'Agora'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setShowNotifications(false);
                          setView('agenda');
                        }}
                        className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-pink-600 bg-pink-50 hover:bg-pink-100 transition-colors"
                      >
                        Ver Agenda Completa
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Dropdown Notificações Mobile Fullscreen Overlay */}
        <AnimatePresence>
          {showNotifications && (
            <div className="fixed inset-0 z-[200] sm:hidden flex items-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNotifications(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full bg-white rounded-t-[3rem] shadow-2xl max-h-[80vh] flex flex-col"
              >
                <div className="p-6 flex items-center justify-between border-b border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">Notificações</h3>
                  <button onClick={() => setShowNotifications(false)} className="p-2 bg-gray-100 rounded-full text-gray-500">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                  {uiNotifications.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                      <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mx-auto">
                        <Bell size={40} />
                      </div>
                      <p className="font-bold text-gray-400">Nenhuma notificação por enquanto.</p>
                    </div>
                  ) : (
                    uiNotifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`p-5 rounded-3xl border-2 transition-all ${!notif.read ? 'bg-pink-50/20 border-pink-100' : 'bg-white border-gray-50'}`}
                      >
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${notif.type === 'new_appointment' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            {notif.type === 'new_appointment' ? <CalendarCheck size={20} /> : <Info size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 mb-1">{notif.title}</p>
                            <p className="text-sm text-gray-500 leading-relaxed">{notif.message}</p>
                            <p className="text-[10px] text-gray-400 mt-3 font-black uppercase tracking-widest">
                              {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), "HH:mm '·' dd 'de' MMMM", { locale: ptBR }) : 'Agora'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 pt-0">
                  <button 
                    onClick={() => {
                      setShowNotifications(false);
                      setView('agenda');
                    }}
                    className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100"
                  >
                    Ver Agenda Completa
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Banner de Trial / Expiração */}
        {subscription.status === 'trial' && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center justify-between border-2 animate-in fade-in slide-in-from-top-4 duration-500 ${
            isTrialExpired ? 'bg-red-50 border-red-200 text-red-700' : 'bg-pink-50 border-pink-100 text-pink-700'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTrialExpired ? 'bg-red-100' : 'bg-white'}`}>
                {isTrialExpired ? <ShieldAlert size={20} /> : <Sparkles size={20} />}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest leading-none">
                  {isTrialExpired ? 'Teste Grátis Expirado' : 'Período de Experiência'}
                </p>
                <p className="text-xs font-bold opacity-80">
                  {isTrialExpired 
                    ? 'Assine um plano para continuar recebendo agendamentos.' 
                    : `Você tem mais ${daysRemaining} dias de acesso total gratuito.`}
                </p>
              </div>
            </div>
            {view !== 'assinatura' && (
              <button 
                onClick={() => setView('assinatura')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isTrialExpired ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-pink-600 text-white hover:bg-pink-700'
                }`}
              >
                {isTrialExpired ? 'Ver Planos' : 'Aproveitar Oferta'}
              </button>
            )}
          </div>
        )}

        {/* VIEW: OVERVIEW */}
        {view === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Alerta de Limite de Plano Essencial */}
            {userPlan === 'bronze' && (
              <div className={`p-4 rounded-2xl border-2 flex items-center justify-between mb-6 ${
                monthlyAppointmentsCount >= 90 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${monthlyAppointmentsCount >= 90 ? 'bg-red-100' : 'bg-white'}`}>
                    <Info size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Uso do Plano Essencial</p>
                    <p className="text-xs font-bold opacity-80">
                      Você usou <strong>{monthlyAppointmentsCount}</strong> de 100 agendamentos este mês.
                    </p>
                  </div>
                </div>
                {monthlyAppointmentsCount >= 80 && (
                  <button 
                    onClick={() => setView('assinatura')}
                    className="px-4 py-2 bg-white/50 hover:bg-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-current"
                  >
                    Fazer Upgrade
                  </button>
                )}
              </div>
            )}

            {/* Link do Mini Site Modernizado */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden group">
              <div className="p-1.5 flex flex-col sm:flex-row items-center gap-2">
                {/* Lado Esquerdo: Link e Icone */}
                <div className="flex-1 flex items-center gap-4 px-5 py-3 sm:py-0 w-full">
                  <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Sparkles size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-pink-400 leading-none mb-1">Seu Link de Agendamento</p>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-gray-300">.../</p>
                      <p className="text-sm font-black text-gray-800 truncate tracking-tight">{currentSlug}</p>
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Ações */}
                <div className="flex items-center gap-2 p-1.5 bg-gray-50/50 rounded-[2rem] w-full sm:w-auto">
                  <button
                     type="button"
                     onClick={handleCopyLink}
                     className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-sm min-w-[160px] ${
                       isCopied 
                         ? 'bg-emerald-500 text-white shadow-emerald-100' 
                         : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-100'
                     }`}
                   >
                     <AnimatePresence mode="wait">
                       {isCopied ? (
                         <motion.div
                           key="copied"
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -10 }}
                           className="flex items-center gap-2"
                         >
                           <Check size={14} strokeWidth={4} />
                           <span>Link Copiado!</span>
                         </motion.div>
                       ) : (
                         <motion.div
                           key="copy"
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -10 }}
                           className="flex items-center gap-2"
                         >
                           <LinkIcon size={14} strokeWidth={4} />
                           <span>Copiar Link Completo</span>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </button>
                </div>
              </div>
            </div>

            <NextAppointmentSection appointments={allAppointments} />
          </div>
        )}

        {/* VIEW: FINANCAS */}
        {view === 'financas' && (
          !hasAccess('financas') ? (
            <UpgradeRequired feature="Gestão Financeira" />
          ) : (
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
          )
        )}

        {/* VIEW: MINISITE (VISUAL DO SITE) */}
        {view === 'minisite' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Visual do seu Site</h2>
              <p className="text-gray-500 font-medium">Personalize a aparência da sua página de agendamento.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Opções de Personalização */}
              <div className="space-y-4">
                {/* Botão de Prévia Mobile */}
                <div className="lg:hidden space-y-1 mb-4">
                  <button
                    onClick={() => setShowMobilePreview(true)}
                    className="w-full py-4 bg-pink-50 text-pink-600 rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border-2 border-pink-100 hover:bg-pink-100 transition-all active:scale-95"
                  >
                    <Smartphone size={16} />
                    Visualizar Página
                  </button>
                  <p className="text-[10px] text-center font-bold text-pink-400 italic">
                    Visualize as alterações em tempo real antes de salvar
                  </p>
                </div>

                {/* Escolha do Layout */}
                <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenSection(openSection === 'layout' ? null : 'layout')}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
                        <Store size={20} />
                      </div>
                      <h3 className="font-bold text-gray-800">Escolha da Página</h3>
                    </div>
                    <ChevronRight size={20} className={`text-gray-400 transition-transform ${openSection === 'layout' ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {openSection === 'layout' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 pt-0 grid grid-cols-1 gap-3">
                          {Object.values(LAYOUTS).map((layout) => {
                            const isRestricted = layout.plan === 'silver' && userPlan === 'bronze';
                            
                            return (
                              <button
                                key={layout.id}
                                onClick={() => {
                                  if (isRestricted) {
                                    showToast("Este layout requer o plano Profissional!", "error");
                                    setView('assinatura');
                                    return;
                                  }
                                  setMinisiteSettings({ ...minisiteSettings, layoutId: layout.id });
                                }}
                                className={`flex items-start justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                                  minisiteSettings.layoutId === layout.id
                                    ? 'border-pink-600 bg-pink-50/30'
                                    : 'border-gray-100 hover:border-pink-200 bg-white'
                                } ${isRestricted ? 'opacity-75' : ''}`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    minisiteSettings.layoutId === layout.id ? 'border-pink-600' : 'border-gray-300'
                                  }`}>
                                    {minisiteSettings.layoutId === layout.id && <div className="w-2.5 h-2.5 bg-pink-600 rounded-full" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-800 flex items-center gap-2">
                                      {layout.name}
                                      {isRestricted && <Lock size={12} className="text-gray-400" />}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                                  </div>
                                </div>
                                {isRestricted && (
                                  <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-2 py-1 rounded-md">Upgrade</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Escolha da Paleta */}
                <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenSection(openSection === 'colors' ? null : 'colors')}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <h3 className="font-bold text-gray-800">Cores e Estilo</h3>
                    </div>
                    <ChevronRight size={20} className={`text-gray-400 transition-transform ${openSection === 'colors' ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {openSection === 'colors' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 pt-0 grid grid-cols-2 gap-3">
                          {Object.values(PALETTES).map((palette) => (
                            <button
                              key={palette.id}
                              onClick={() => {
                                setMinisiteSettings({ ...minisiteSettings, paletteId: palette.id });
                              }}
                              className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                                minisiteSettings.paletteId === palette.id
                                  ? 'border-pink-600 bg-pink-50/30'
                                  : 'border-gray-100 hover:border-pink-200 bg-white'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg ${palette.primary} ${palette.gradient && `bg-gradient-to-br ${palette.gradient}`} shrink-0`} />
                              <span className="text-xs font-bold text-gray-700">{palette.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* NOVO: IDENTIDADE DO SITE (MODO MARCA PESSOAL) */}
                <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenSection(openSection === 'identity' ? null : 'identity')}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Users size={20} />
                      </div>
                      <h3 className="font-bold text-gray-800">Identidade do Site</h3>
                    </div>
                    <ChevronRight size={20} className={`text-gray-400 transition-transform ${openSection === 'identity' ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {openSection === 'identity' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 pt-0 space-y-6">
                          <div className="flex bg-gray-50 p-1.5 rounded-2xl">
                            <button
                              onClick={() => setMinisiteSettings({ ...minisiteSettings, identityMode: 'corporative' })}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                minisiteSettings.identityMode === 'corporative'
                                  ? 'bg-white text-indigo-600 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Marca do Salão
                            </button>
                            <button
                              onClick={() => setMinisiteSettings({ ...minisiteSettings, identityMode: 'personal' })}
                              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                minisiteSettings.identityMode === 'personal'
                                  ? 'bg-white text-indigo-600 shadow-sm'
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              Marca Pessoal
                            </button>
                          </div>

                          <AnimatePresence mode="wait">
                            {minisiteSettings.identityMode === 'personal' ? (
                              <motion.div
                                key="personal"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                              >
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Nome da Profissional</label>
                                  <input
                                    type="text"
                                    value={profileInfo.professionalName}
                                    onChange={(e) => setProfileInfo({ ...profileInfo, professionalName: e.target.value })}
                                    className="w-full p-4 bg-indigo-50/30 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                                    placeholder="Ex: Dra. Ana Silva"
                                  />
                                </div>
                                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                  <p className="text-[10px] font-bold text-indigo-400 leading-relaxed uppercase tracking-wider">
                                    ✨ No Modo Marca Pessoal, usaremos o seu nome e sua foto de perfil em destaque no site.
                                  </p>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="corporative"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-4 bg-gray-50 rounded-2xl border border-gray-100"
                              >
                                <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-wider text-center">
                                  Usando o Nome e o Logo do seu estabelecimento configurados no perfil.
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bio e Opções */}
                <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenSection(openSection === 'texts' ? null : 'texts')}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Pencil size={20} />
                      </div>
                      <h3 className="font-bold text-gray-800">Textos do Site</h3>
                    </div>
                    <ChevronRight size={20} className={`text-gray-400 transition-transform ${openSection === 'texts' ? 'rotate-90' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {openSection === 'texts' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 pt-0 space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Bio / Descrição Principal</label>
                            <textarea
                              rows={2}
                              value={minisiteSettings.bioText}
                              onChange={(e) => setMinisiteSettings({ ...minisiteSettings, bioText: e.target.value })}
                              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-medium text-gray-700 text-sm resize-none"
                              placeholder="Ex: Realçando sua beleza natural ✨"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between p-2">
                            <div>
                              <p className="text-sm font-bold text-gray-800">Exibir Descrição</p>
                              <p className="text-xs text-gray-500">Mostra o texto de bio/descrição no seu site.</p>
                            </div>
                            <button
                              onClick={() => setMinisiteSettings({ ...minisiteSettings, showDescription: !minisiteSettings.showDescription })}
                              className={`w-12 h-6 rounded-full transition-colors relative ${minisiteSettings.showDescription ? 'bg-pink-600' : 'bg-gray-200'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${minisiteSettings.showDescription ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={saveMinisiteSettings}
                  disabled={loading}
                  className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>

              {/* Preview Simulado */}
              <div className="sticky top-10 h-fit space-y-4 hidden lg:block">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Prévia do Layout</p>
                <div className="aspect-[9/19] w-full max-w-[320px] mx-auto bg-white rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden relative flex flex-col">
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <MiniSiteRenderer
                      establishment={{
                        ...establishment,
                        ...profileInfo
                      }}
                      onBookClick={() => {}}
                      settings={minisiteSettings}
                      services={services}
                    />
                  </div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-slate-950/20 rounded-full z-20" />
                </div>
                <p className="text-center text-[10px] font-bold text-gray-400 italic">Visualização em tempo real</p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: ASSINATURA (SaaS) */}
        {view === 'assinatura' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">Escolha o Plano Ideal</h2>
              <p className="text-gray-500 font-medium max-w-xl mx-auto">
                Potencialize sua estética com ferramentas profissionais de agendamento e gestão.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {PLANS.map(plan => (
                <div 
                  key={plan.id}
                  className={`relative bg-white rounded-[3rem] p-8 border-2 transition-all hover:shadow-2xl ${
                    plan.popular ? 'border-pink-600 shadow-xl shadow-pink-100 scale-105 z-10' : 'border-gray-100 shadow-sm'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Mais Popular
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      plan.color === 'pink' ? 'bg-pink-50 text-pink-600' : 
                      plan.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      <plan.icon size={32} />
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-gray-900">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-sm font-bold text-gray-400">R$</span>
                        <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                        <span className="text-sm font-bold text-gray-400">/mês</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {plan.features.map(feature => (
                        <div key={feature} className="flex items-center gap-3">
                          <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Check size={12} strokeWidth={4} />
                          </div>
                          <span className="text-sm font-bold text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                        plan.popular ? 'bg-pink-600 text-white shadow-lg shadow-pink-200 hover:bg-pink-700' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                      onClick={() => showToast(`Checkout ${plan.name} em breve!`)}
                    >
                      Assinar Agora
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <CreditCard className="text-pink-400" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Pagamento Seguro & Transparente</h4>
                  <p className="text-sm text-white/60">Cancele quando quiser. Sem taxas escondidas.</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
                  <span className="text-[10px] font-black tracking-widest text-slate-900">VISA</span>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
                  <span className="text-[9px] font-black tracking-widest text-slate-900">MASTER</span>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
                  <span className="text-[10px] font-black tracking-widest text-slate-900">PAY</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: EQUIPE */}
        {view === 'equipe' && (
          !hasAccess('multiprofissional') ? (
            <UpgradeRequired feature="Gestão de Equipe" />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Minha Equipe</h2>
                <p className="text-gray-500 font-medium">Adicione e gerencie os profissionais da sua estética.</p>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                  <Users size={40} />
                </div>
                <p className="text-gray-400 font-medium">Você é o único profissional cadastrado no momento.</p>
                <button className="mt-4 bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100">
                  <Plus size={16} /> Adicionar Profissional
                </button>
              </div>
            </div>
          )
        )}
        {view === 'clientes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Clientes</h2>
                <p className="text-gray-500 font-medium">Gestão da sua base de clientes ({clientsList.length}).</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-2xl justify-end">
                <div className="relative flex-1 max-w-sm">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-pink-100 rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 shadow-sm"
                  />
                </div>

                <button 
                  onClick={() => setIsClientModalOpen(true)}
                  className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
                >
                  <Plus size={16} strokeWidth={3} />
                  Novo Cliente
                </button>
              </div>
            </div>

            {clientsList.length === 0 ? (
              <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                  <Users size={40} />
                </div>
                <p className="text-gray-400 font-medium">
                  {searchTerm ? 'Nenhum cliente encontrado para sua busca.' : 'Sua lista de clientes aparecerá aqui conforme os agendamentos forem realizados.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientsList.slice(0, visibleClientsCount).map(client => {
                  const isExpanded = expandedClientId === client.uid;
                  
                  // Lógica de Status
                  const lastVisitDate = client.lastVisit;
                  const isInactive = !lastVisitDate || (new Date() - lastVisitDate) > (60 * 24 * 60 * 60 * 1000); // 60 dias
                  
                  return (
                    <div 
                      key={client.uid} 
                      className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                        isExpanded ? 'border-pink-200 shadow-xl shadow-pink-100/50 ring-1 ring-pink-100' : 'border-gray-100 shadow-sm hover:border-pink-100'
                      }`}
                    >
                      {/* Header do Accordion */}
                      <button
                        onClick={() => {
                          setExpandedClientId(isExpanded ? null : client.uid);
                          setActiveClientTab('detalhes');
                        }}
                        className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0 transition-transform duration-300 ${isExpanded ? 'scale-110' : 'group-hover:scale-105'}`}>
                            {client.photoURL ? (
                              <img src={client.photoURL} alt={client.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-pink-50 flex items-center justify-center text-pink-300">
                                <User size={20} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className={`text-base font-black truncate transition-colors ${isExpanded ? 'text-pink-600' : 'text-gray-800'}`}>
                              {client.nome}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-gray-300' : 'bg-emerald-500'}`} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {isInactive ? 'Inativa' : 'Ativa'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-pink-600 text-white rotate-180' : 'bg-gray-50 text-gray-400 group-hover:bg-pink-50 group-hover:text-pink-600'}`}>
                          <ChevronDown size={20} strokeWidth={3} />
                        </div>
                      </button>

                      {/* Conteúdo Expandido */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                          >
                            <div className="px-6 pb-6 pt-2 border-t border-gray-50 space-y-6">
                              {/* Destaques Rápidos */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
                                  <Calendar size={14} className="text-gray-400 mb-1" />
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Última</span>
                                  <span className="text-[11px] font-black text-gray-700 leading-none">
                                    {client.lastVisit ? format(client.lastVisit, "dd/MM/yy") : '---'}
                                  </span>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                                  <DollarSign size={14} className="text-emerald-400 mb-1" />
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter leading-none mb-1">Gasto</span>
                                  <span className="text-[11px] font-black text-emerald-700 leading-none">R$ {client.totalSpent}</span>
                                </div>
                                <div className="bg-pink-50 p-3 rounded-2xl border border-pink-100 flex flex-col items-center justify-center text-center">
                                  <Users size={14} className="text-pink-400 mb-1" />
                                  <span className="text-[9px] font-black text-pink-400 uppercase tracking-tighter leading-none mb-1">Visitas</span>
                                  <span className="text-[11px] font-black text-pink-700 leading-none">{client.totalAppointments}</span>
                                </div>
                              </div>

                              {/* Abas Internas e Botão Excluir */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl w-fit">
                                  <button
                                    onClick={() => setActiveClientTab('detalhes')}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                      activeClientTab === 'detalhes' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                  >
                                    Detalhes
                                  </button>
                                  <button
                                    onClick={() => setActiveClientTab('historico')}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                      activeClientTab === 'historico' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                  >
                                    Histórico
                                  </button>
                                </div>
                                
                                <button
                                    onClick={() => setDeleteConfirmModal({ open: true, client })}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all border border-red-50 hover:border-red-100"
                                    title={client.type === 'manual' ? 'Excluir Cliente' : 'Ocultar da Lista'}
                                  >
                                  <Trash2 size={16} />
                                </button>
                              </div>

                              {/* Conteúdo das Abas */}
                              <div className="animate-in fade-in duration-300">
                                {activeClientTab === 'detalhes' ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-3 text-sm font-bold text-gray-600 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                        <div className="w-8 h-8 bg-white text-emerald-500 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                                          <Star size={16} fill="currentColor" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-0.5">Contato Premium</p>
                                          <p className="truncate">{formatPhone(client.telefone)}</p>
                                        </div>
                                          {client.telefone && (
                                            <a 
                                              href={`https://wa.me/${client.telefone.replace(/\D/g, '').startsWith('55') ? client.telefone.replace(/\D/g, '') : `55${client.telefone.replace(/\D/g, '')}`}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="ml-auto w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-100"
                                            >
                                              <MessageCircleMore size={14} />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group/note relative">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Observações Internas</p>
                                        
                                        {editingNote.id === client.uid ? (
                                          <div className="space-y-2">
                                            <textarea
                                              autoFocus
                                              value={editingNote.text}
                                              onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                                              className="w-full bg-white border-2 border-pink-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none min-h-[80px] resize-none"
                                              placeholder="Digite aqui..."
                                            />
                                            <div className="flex justify-end gap-2">
                                              <button 
                                                onClick={() => setEditingNote({ id: null, text: '' })}
                                                className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600"
                                              >
                                                Cancelar
                                              </button>
                                              <button 
                                                onClick={() => handleSaveNote(client)}
                                                disabled={isSavingNote}
                                                className="text-[9px] font-black uppercase text-pink-600 hover:text-pink-700 disabled:opacity-50"
                                              >
                                                {isSavingNote ? 'Salvando...' : 'Salvar'}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div 
                                            onClick={() => setEditingNote({ id: client.uid, text: client.notes || '' })}
                                            className="cursor-pointer"
                                          >
                                            {client.notes ? (
                                              <p className="text-xs font-bold text-slate-600 leading-relaxed">{client.notes}</p>
                                            ) : (
                                              <p className="text-xs font-bold text-slate-500 italic">Clique para adicionar uma observação sobre esta cliente...</p>
                                            )}
                                            <div className="absolute top-4 right-4 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                              <Pencil size={12} className="text-pink-400" />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                                      {client.appointments?.length > 0 ? (
                                        client.appointments.slice(0, 3).map((app, idx) => (
                                          <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-white rounded-xl shadow-sm border border-gray-50">
                                            <div className="min-w-0">
                                              <p className="text-xs font-black text-gray-800 truncate">{app.service_nome || app.serviceName}</p>
                                              <p className="text-[10px] font-bold text-gray-400">{format(safeToDate(app.data_hora), "dd 'de' MMMM", { locale: ptBR })}</p>
                                            </div>
                                            <span className="text-xs font-black text-emerald-600 shrink-0">R$ {app.total_price || app.preco || 0}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-xs font-bold text-gray-400 text-center py-4">Nenhum serviço realizado ainda.</p>
                                      )}
                                      {client.appointments?.length > 5 && (
                                        <p className="text-center text-[10px] font-black text-pink-500 pt-2 uppercase tracking-widest">Ver histórico completo</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {clientsList.length > visibleClientsCount && (
                  <div className="pt-6 flex justify-center">
                    <button
                      onClick={() => setVisibleClientsCount(prev => prev + 10)}
                      className="px-8 py-4 bg-white border-2 border-pink-100 text-pink-600 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-pink-50 transition-all shadow-sm active:scale-95"
                    >
                      Ver mais clientes ({clientsList.length - visibleClientsCount} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}
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

            {agendaView === 'calendar' ? (
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
            ) : (
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
                      <div 
                        key={app.id} 
                        onClick={() => {
                          setSelectedApp(app);
                          setIsAppDetailsModalOpen(true);
                        }}
                        className={`bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-2 shadow-sm transition-all cursor-pointer hover:border-pink-200 ${
                          (app.status === 'cancelado' || app.status === 'cancelled') ? 'opacity-50 grayscale border-gray-100' : 'border-pink-50'
                        }`}
                      >
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
                                  {app.status === 'scheduled' ? 'Agendado' : app.status === 'ativo' ? 'Ativo' : app.status === 'completed' ? 'Finalizado' : app.status === 'cancelled' ? 'Cancelado' : app.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 flex items-center gap-1 font-medium">
                                <Sparkles size={14} className="text-pink-400" /> {app.service_nome}
                              </p>
                            </div>
                          </div>
                          {(app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelAppointment(app.id);
                              }} 
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Serviços</h2>
                <p className="text-gray-500 font-medium">Gerencie o catálogo de serviços oferecidos ({services.length}).</p>
              </div>

              <button 
                onClick={() => {
                  setEditingServiceId(null);
                  setNewService({ nome: '', descricao: '', duracao: 30, preco: '' });
                  setIsServiceModalOpen(true);
                }}
                className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
              >
                <Plus size={16} strokeWidth={3} />
                Novo Serviço
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.length === 0 ? (
                <div className="sm:col-span-2 bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={40} />
                  </div>
                  <p className="text-gray-400 font-medium">Nenhum serviço cadastrado.</p>
                  <button
                    onClick={() => setIsServiceModalOpen(true)}
                    className="mt-4 text-pink-600 font-bold text-sm hover:underline"
                  >
                    Cadastrar seu primeiro serviço
                  </button>
                </div>
              ) : (
                services.map(s => (
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
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW: CONFIG */}
        {view === 'config' && (
          <form onSubmit={saveSettings} className="animate-in fade-in zoom-in-95 duration-500 space-y-4">
            
            {/* Link da Estética */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenConfigSection(openConfigSection === 'link' ? null : 'link')}
                className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <LinkIcon size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Seu Link Único</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Endereço para agendamentos das clientes.</p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'link' ? 'rotate-90' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              </button>

              <AnimatePresence>
                {openConfigSection === 'link' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-8 sm:px-8 space-y-6">
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Identidade do Salão (Antiga Identidade Visual) */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenConfigSection(openConfigSection === 'visual' ? null : 'visual')}
                className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <Store size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Identidade do Salão</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Logo, endereço, contato e descrição da estética.</p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'visual' ? 'rotate-90' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              </button>

              <AnimatePresence>
                {openConfigSection === 'visual' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-8 sm:px-8 space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:gap-6">
                        <div className="space-y-3">
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
                              placeholder="Nome do seu estabelecimento"
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
                              placeholder="Rua, número, bairro e cidade"
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
                              onChange={e => setProfileInfo({...profileInfo, telefone: maskPhone(e.target.value)})}                              className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">Instagram (@perfil)</label>
                          <div className="relative">
                            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                            <input
                              type="text"
                              value={profileInfo.instagram}
                              onChange={e => setProfileInfo({ ...profileInfo, instagram: e.target.value.replace(/\s+/g, '') })}
                              className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                              placeholder="@seu.instagram"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-2">Descrição da Estética</label>
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
                            placeholder="Conte um pouco sobre os seus diferenciais..."
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Perfil Profissional (Informações da Dona) */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenConfigSection(openConfigSection === 'perfil' ? null : 'perfil')}
                className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <User size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Perfil Profissional</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Informações da dona da estética.</p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'perfil' ? 'rotate-90' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              </button>

              <AnimatePresence>
                {openConfigSection === 'perfil' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-8 sm:px-8 space-y-6">
                      <div className="grid grid-cols-1 gap-4 sm:gap-6">
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">Sua Foto de Perfil</label>
                          <div className="bg-indigo-50/30 border-2 border-transparent rounded-[2rem] p-4 sm:p-5 flex items-center gap-6">
                            <label htmlFor="photo-upload" className="cursor-pointer">
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border border-indigo-100 overflow-hidden flex items-center justify-center shrink-0 relative shadow-md">
                                {profileInfo.photoURL ? (
                                  <img src={profileInfo.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                                ) : (
                                  <User size={40} className="text-indigo-200" />
                                )}
                                {photoUploading && (
                                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                  </div>
                                )}
                              </div>
                            </label>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-bold text-gray-700">Sua foto profissional</p>
                              <p className="text-xs text-gray-500">Aparecerá no menu lateral e quando usar a 'Marca Pessoal'.</p>
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
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nome da Dona da Estética</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                            <input 
                              type="text"
                              required
                              value={profileInfo.professionalName}
                              onChange={e => setProfileInfo({...profileInfo, professionalName: e.target.value})}
                              className="w-full pl-12 pr-4 py-3 sm:py-4 bg-indigo-50/30 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                              placeholder="Seu nome completo"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 ml-2">✨ Este nome será usado no site quando você ativar o modo 'Marca Pessoal'.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Política de Cancelamento */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPolicyOpen(v => !v)}
                className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <Shield size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Política de Cancelamento</h3>
                    <p className="text-xs sm:text-sm text-gray-500">
                      Regras de cancelamento e atraso.
                    </p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${isPolicyOpen ? 'rotate-90' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              </button>

              <AnimatePresence>
                {isPolicyOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-8 sm:px-8">
                      <CancellationPolicySettings establishment={establishment} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-4">
              <button type="submit" className="w-full bg-slate-950 text-white py-4 sm:py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-800 shadow-xl shadow-slate-100 transition-all active:scale-95">
                Salvar Alterações
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Modal para Adicionar Cliente Manualmente */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClientModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600" />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Novo Cliente</h3>
                <button 
                  onClick={() => setIsClientModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddManualClient} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={newClient.nome}
                    onChange={e => setNewClient({ ...newClient, nome: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Ex: Maria Oliveira"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">WhatsApp / Telefone</label>
                  <input
                    type="tel"
                    required
                    value={newClient.telefone}
                    onChange={e => setNewClient({ ...newClient, telefone: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Cadastro/Edição de Serviço */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetServiceForm}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600" />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                  {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
                </h3>
                <button 
                  onClick={resetServiceForm}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Nome do Serviço</label>
                  <input
                    type="text"
                    required
                    value={newService.nome}
                    onChange={e => setNewService({ ...newService, nome: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Ex: Limpeza de Pele"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Descrição</label>
                    <span className="text-[9px] font-bold text-gray-400 mr-2">
                      {newService.descricao.length}/{SERVICE_DESCRIPTION_LIMIT}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={SERVICE_DESCRIPTION_LIMIT}
                    value={newService.descricao}
                    onChange={e => setNewService({ ...newService, descricao: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm resize-none"
                    placeholder="Descreva o serviço para a cliente..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Duração (min)</label>
                    <input
                      type="number"
                      required
                      value={newService.duracao}
                      onChange={e => setNewService({ ...newService, duracao: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                      placeholder="Ex: 60"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Preço (R$)</label>
                    <input
                      type="number"
                      required
                      value={newService.preco}
                      onChange={e => setNewService({ ...newService, preco: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                      placeholder="Ex: 150"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={resetServiceForm}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : editingServiceId ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AppointmentDetailsModal 
        isOpen={isAppDetailsModalOpen}
        onClose={() => setIsAppDetailsModalOpen(false)}
        appointment={selectedApp}
        onCancel={handleCancelAppointment}
        onComplete={handleCompleteAppointment}
      />

      {/* Modal de Prévia do Minisite para Mobile */}
      <AnimatePresence>
        {showMobilePreview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobilePreview(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[320px] aspect-[9/19] bg-white rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <MiniSiteRenderer
                  establishment={{
                    ...establishment,
                    ...profileInfo
                  }}
                  onBookClick={() => {}}
                  settings={minisiteSettings}
                  services={services}
                />
              </div>

              <button 
                onClick={() => setShowMobilePreview(false)}
                className="absolute top-6 right-6 p-2 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-all z-20"
              >
                <X size={20} />
              </button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-slate-950/20 rounded-full z-20" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão Customizado */}
      <AnimatePresence>
        {deleteConfirmModal.open && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmModal({ open: false, client: null })}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 overflow-hidden text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert size={40} />
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Atenção!</h3>
              
              <div className="space-y-4 mb-8">
                <p className="text-sm font-bold text-gray-600 leading-relaxed">
                  {deleteConfirmModal.client?.type === 'manual' 
                    ? `Deseja realmente EXCLUIR permanentemente a cliente "${deleteConfirmModal.client?.nome}"?`
                    : `Deseja OCULTAR a cliente "${deleteConfirmModal.client?.nome}" da sua lista?`}
                </p>
                <p className="text-xs text-gray-400 font-medium bg-gray-50 p-3 rounded-2xl">
                  {deleteConfirmModal.client?.type === 'manual'
                    ? 'Isso apagará TODOS os dados, observações e registros desta cliente para sempre. Esta ação NÃO pode ser desfeita!'
                    : 'Ela não aparecerá mais nesta listagem, mas os agendamentos antigos permanecerão salvos no seu histórico financeiro.'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteClient}
                  disabled={loading}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Processando...' : deleteConfirmModal.client?.type === 'manual' ? 'Sim, Excluir Agora' : 'Sim, Ocultar Cliente'}
                </button>
                <button
                  onClick={() => setDeleteConfirmModal({ open: false, client: null })}
                  className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sistema de Toast Customizado */}
       <AnimatePresence>
         {toast.show && (
           <motion.div
             initial={{ opacity: 0, y: -50, x: '-50%', scale: 0.9 }}
             animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
             exit={{ opacity: 0, y: -20, x: '-50%', scale: 0.9 }}
             className="fixed top-24 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-sm"
           >
             <div className={`px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
               toast.type === 'success' 
                 ? 'bg-emerald-500/95 border-emerald-400 text-white shadow-emerald-200/50' 
                 : 'bg-red-500/95 border-red-400 text-white shadow-red-200/50'
             }`}>
               <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                 {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
               </div>
               <p className="text-[11px] font-black uppercase tracking-widest leading-tight">{toast.message}</p>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
