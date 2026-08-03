import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { anamnesisService } from '../services/anamnesisService';
import { format, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth, addMinutes, isAfter, subDays, startOfYear, endOfYear, addDays } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
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
  PlusCircle,
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
  Camera,
  Image as ImageIcon,
  ClipboardList,
  Shield,
  ShieldAlert,
  Link as LinkIcon,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Crown,
  Gift,
  Zap,
  Check,
  Percent,
  MessageCircle,
  MessageCircleMore,
  ChevronDown,
  ChevronUp,
  Mail,
  Info,
  Lock,
  Bell,
  Eye,
  EyeOff,
  FileDown,
  Share2,
  Save,
  Undo2
} from 'lucide-react';
import { isSlugAvailable, sanitizeSlug } from '../services/establishmentService';
import { createAppointment, APPOINTMENT_STATUS, normalizeStatus, getAvailableSlots, getMultiProfessionalAvailableSlots } from '../services/appointmentService';
import { recordAppointmentTransaction, getTransactions, markCommissionAsPaid } from '../services/financeService';
import { 
  createManagedStaffAccount, 
  deleteManagedStaffAccount
} from '../services/teamService';
import OnboardingWizard from '../components/admin/onboarding/OnboardingWizard';
import WeeklyAvailabilityEditor from '../components/admin/settings/WeeklyAvailabilityEditor';
import CancellationPolicySettings from '../components/admin/settings/CancellationPolicySettings';
import AvailabilityCalendar from '../components/admin/settings/AvailabilityCalendar';
import AnamnesisManager from '../components/admin/settings/AnamnesisManager';
import ReminderManager from '../components/admin/dashboard/ReminderManager';
import ProfessionalAvatar from '../components/admin/dashboard/ProfessionalAvatar';
import AnamnesisForm from '../components/client/AnamnesisForm';
import NextAppointmentSection from '../components/admin/dashboard/NextAppointmentSection';
import AppointmentCalendar from '../components/admin/dashboard/AppointmentCalendar';
import SidebarContent from '../components/admin/dashboard/SidebarContent';
import AppointmentDetailsModal from '../components/admin/dashboard/AppointmentDetailsModal';
import SubscriptionGuard from '../components/admin/dashboard/SubscriptionGuard';
import OverviewSection from '../components/admin/dashboard/sections/OverviewSection';
import RelatoriosSection from '../components/admin/dashboard/sections/RelatoriosSection';
import AssinaturaSection from '../components/admin/dashboard/sections/AssinaturaSection';
import HorariosSection from '../components/admin/dashboard/sections/HorariosSection';
import AnamneseSection from '../components/admin/dashboard/sections/AnamneseSection';
import LembretesSection from '../components/admin/dashboard/sections/LembretesSection';
import ServicosSection from '../components/admin/dashboard/sections/ServicosSection';
import MinisiteSection from '../components/admin/dashboard/sections/MinisiteSection';
import EquipeSection from '../components/admin/dashboard/sections/EquipeSection';
import ClientesSection from '../components/admin/dashboard/sections/ClientesSection';
import AgendaSection from '../components/admin/dashboard/sections/AgendaSection';
import FinancasSection from '../components/admin/dashboard/sections/FinancasSection';
import ConfigSection from '../components/admin/dashboard/sections/ConfigSection';
import { subscriptionService } from '../services/subscriptionService';
import { createInternalNotification, createClientNotification, createAppointmentEventNotification } from '../services/notificationService';
import ScheduleSection from '../components/client/ScheduleSection';
import { MobileTopbar, MobileDrawer } from '../components/admin/dashboard/MobileNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LAYOUTS, PALETTES, DEFAULT_SETTINGS } from '../components/client/minisite/registry';
import MiniSiteRenderer from '../components/client/minisite/MiniSiteRenderer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const [allAppointments, setAllAppointments] = useState([]); // Todos os agendamentos do admin (para lógica e verificação)
  const [appointments, setAppointments] = useState([]); // Agendamentos filtrados para a UI
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('overview'); // 'overview', 'agenda', 'financas', 'servicos', 'config', 'clientes', 'relatorios'

  // GUARD: STAFF só pode acessar as views permitidas.
  // Mesmo que o usuário force setView por DevTools, esse useEffect reseta para overview.
  useEffect(() => {
    if (user?.tipo !== 'staff') return;
    const STAFF_ALLOWED_VIEWS = [
      'overview',
      'agenda',
      'comissoes',
      'lembretes',
      'anamnese',
      'config',
    ];
    if (!STAFF_ALLOWED_VIEWS.includes(view)) {
      setView('overview');
    }
  }, [view, user?.tipo]);

  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [agendaView, setAgendaView] = useState('list'); // 'list', 'calendar'
  const [showWeeklyEditor, setShowWeeklyEditor] = useState(false);
  const [showIntervalEditor, setShowIntervalEditor] = useState(false);
  const [tempInterval, setTempInterval] = useState(30);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
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
  const [isCancelSubscriptionModalOpen, setIsCancelSubscriptionModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ nome: '', telefone: '' });
  const [manualClients, setManualClients] = useState([]);
  const [expandedClientId, setExpandedClientId] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('detalhes'); // 'detalhes', 'historico' ou 'anamnese'
  const [clientAnamnesis, setClientAnamnesis] = useState([]);
  const [loadingClientAnamnesis, setLoadingClientAnamnesis] = useState(false);
  const [selectedClientAnamnesis, setSelectedClientAnamnesis] = useState(null);
  const [visibleClientsCount, setVisibleClientsCount] = useState(10);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isAppDetailsModalOpen, setIsAppDetailsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState({ id: null, text: '' });
  const [openConfigSection, setOpenConfigSection] = useState('link'); // 'link', 'visual', 'perfil'
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenReminderIds, setSeenReminderIds] = useState([]);
  const [forceShowOnboarding, setForceShowOnboarding] = useState(false);

  // B-11: Desfazer cancelamento appointment (janela 2 min)
  const undoLastCancelRef = React.useRef(null);
  const [pendingCancelUndo, setPendingCancelUndo] = useState(null); // { appointmentId, expiresAt }
  const [, forceUndoTick] = useState(0);

  // Estados para Anamnese na aba Clientes
  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false);
  const [anamnesisTemplates, setAnamnesisTemplates] = useState([]);
  const [activeAnamnesisTemplate, setActiveAnamnesisTemplate] = useState(null);
  const [anamnesisCustomerId, setAnamnesisCustomerId] = useState(null);
  const [isFillingAnamnesis, setIsFillingAnamnesis] = useState(false);

  // Estados para a Aba Equipe
  const [team, setTeam] = useState([]);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [newMember, setNewMember] = useState({ 
    nome: '', 
    cargo: '', 
    foto: '', 
    servicos: [], 
    email: '', 
    password: '',
    commission_percentage: 0, // Novo campo
    break_time: { enabled: false, start: '12:00', end: '13:00' }
  });
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null); // Para mostrar após o cadastro
  const [professionalFilter, setProfessionalFilter] = useState(user?.tipo === 'staff' ? user.professional_id : 'all');
  const [isManualAppModalOpen, setIsManualAppModalOpen] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ 
    currentPassword: '',
    newPassword: '', 
    confirmPassword: '' 
  });
  const [professionalPhotoUploading, setProfessionalPhotoUploading] = useState(null); // ID do profissional fazendo upload
  const [showTeamPassword, setShowTeamPassword] = useState(false);
  const [manualAppData, setManualAppData] = useState({ 
    user_nome: '', 
    user_telefone: '', 
    service_id: '', 
    professional_id: '', 
    data_hora: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [isSavingManualApp, setIsSavingManualApp] = useState(false);
  const [remarcacaoOrigem, setRemarcacaoOrigem] = useState(null); // ID do agendamento sendo remarcado
  
  const handleUpdateAppointment = async (appointmentId, updates) => {
    try {
      setLoading(true);
      await updateDoc(doc(db, "appointments", appointmentId), updates);
      showToast("Agendamento atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      showToast("Erro ao atualizar agendamento.", "error");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setLoading(true);
      await subscriptionService.cancelSubscription(establishment.id);
      showToast("Assinatura cancelada com sucesso. Você voltará para o plano bronze ao fim do ciclo.", "success");
      setIsCancelSubscriptionModalOpen(false);
      // Recarrega para atualizar o estado da assinatura na UI
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      showToast("Erro ao cancelar assinatura. Tente novamente mais tarde.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const handleConfirmReschedule = async (appointment, newSlot) => {
    try {
      setLoading(true);
      
      // Dados do novo agendamento baseados no antigo
      const start = newSlot;
      const dur = appointment.total_duration || appointment.duration || 30;
      
      // Recalcula o itinerário para o novo horário
      let currentOffset = 0;
      const newServices = (appointment.services || []).map(s => {
        const sStart = addMinutes(start, currentOffset);
        const sDur = Number(s.duracao || s.duration || 30);
        const sEnd = addMinutes(sStart, sDur);
        currentOffset += sDur;
        return {
          ...s,
          start_time: sStart,
          end_time: sEnd
        };
      });

      const appPayload = {
        ...appointment,
        data_hora: start,
        services: newServices,
        itinerary: newServices,
        status: APPOINTMENT_STATUS.SCHEDULED,
        tipo: 'remarcado'
      };
      
      // Remove campos que o Firebase não gosta em novos docs (como o ID antigo)
      delete appPayload.id;
      if (appPayload.createdAt) delete appPayload.createdAt;

      await createAppointment(appPayload);
      
      // Notificação para o cliente
      if (appointment.user_id && appointment.user_id !== 'manual') {
        await createClientNotification(
          establishment.id,
          appointment.user_id,
          'appointment_rescheduled',
          'Horário Alterado 📅',
          `Seu agendamento para ${appointment.service_nome || 'Serviço'} foi alterado para ${format(start, "dd/MM 'às' HH:mm")}.`
        );
        console.log("Notificação de remarcação criada para o cliente:", appointment.user_id);
      }

      // Cancela o antigo
      await updateDoc(doc(db, "appointments", appointment.id), { 
        status: APPOINTMENT_STATUS.CANCELLED,
        remarcado_para: start 
      });

      showToast("Agendamento remarcado com sucesso!");
    } catch (error) {
      console.error("Erro ao remarcar:", error);
      showToast("Erro ao remarcar. Verifique a disponibilidade.", "error");
    } finally {
      setLoading(false);
    }
  };

  const PLANS = [
    {
      id: 'bronze',
      name: 'Essencial',
      price: '19,99',
      color: 'pink',
      icon: Star,
      description: 'Perfeito para quem trabalha só.',
      features: [
        '100 Agendamentos /mês',
        'Gestão de Clientes',
        'Ficha de Anamnese Básica',
        '2 Layouts de Mini-site',
        'Suporte via E-mail (24h)'
      ],
      popular: false
    },
    {
      id: 'silver',
      name: 'Profissional',
      price: '29,99',
      color: 'blue',
      icon: Users,
      description: 'Ideal para pequenos times.',
      features: [
        'Até 3 Profissionais',
        'Agendamentos Ilimitados',
        'Relatórios de Faturamento',
        'Layouts Intermediários',
        'Suporte Prioritário (Chat)'
      ],
      popular: true
    },
    {
      id: 'gold',
      name: 'Premium VIP',
      price: '44,99',
      color: 'amber',
      icon: Crown,
      description: 'O máximo em produtividade.',
      features: [
        'Até 7 Profissionais',
        'Combos Multi-Profissionais',
        'Todos os Layouts VIP',
        'Cálculo de Comissões',
        'Suporte VIP (WhatsApp)'
      ],
      popular: false
    }
  ];

  // Lógica de Permissões por Plano
  const userPlan = establishment?.plan || establishment?.subscription?.plan || 'bronze'; // bronze, silver, gold
  const subscriptionStatus = subscriptionService.checkSubscriptionStatus(establishment);
  
  const hasAccess = (feature) => {
    if (!establishment?.subscription) return false;
    const status = establishment.subscription.status;
    const plan = userPlan;
    
    // Verifica se o trial ainda é válido (se status for trial)
    const isTrialValid = status === 'trial' && 
      establishment.subscription.trial_ends_at && 
      !isAfter(new Date(), establishment.subscription.trial_ends_at.toDate());

    // Se não for active e não for trial válido, só libera visualização de assinaturas
    if (status !== 'active' && !isTrialValid && feature !== 'assinatura') return false;

    const teamLimit = plan === 'bronze' ? 1 : plan === 'silver' ? 3 : 7;
    const currentTeamCount = team.length + 1; // Dona + Equipe

    switch (feature) {
      case 'multiprofissional':
        return plan === 'silver' || plan === 'gold';
      case 'equipe':
        return currentTeamCount < teamLimit;
      case 'combos':
        return plan === 'gold';
      case 'layouts_intermediarios':
        return plan === 'silver' || plan === 'gold';
      case 'layouts_vip':
        return plan === 'gold';
      case 'relatorios_avancados':
        return plan === 'gold';
      case 'financeiro_avancado':
        return plan === 'gold';
      case 'agendamentos_ilimitados':
        return plan !== 'bronze';
      default:
        return true;
    }
  };

  useEffect(() => {
    // Tratamento de Retorno de Pagamento (Mercado Pago)
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    
    if (paymentStatus === 'success') {
      showToast("Pagamento aprovado! Sua assinatura está sendo ativada.", "success");
      // Limpa os parâmetros da URL para não repetir o toast
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Força uma atualização dos dados do estabelecimento para refletir o novo plano
      // O Webhook do Firebase já deve ter processado, mas damos um refresh visual
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else if (paymentStatus === 'failure') {
      showToast("O pagamento não foi concluído. Tente novamente.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'pending') {
      showToast("Pagamento em processamento. Avisaremos quando for aprovado!", "info");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
      const status = normalizeStatus(app.status);
      if (status === APPOINTMENT_STATUS.CANCELLED || status === APPOINTMENT_STATUS.COMPLETED) return;

      // Se for staff, filtra para gerar lembretes apenas dos seus atendimentos
      if (user?.tipo === 'staff' && user?.professional_id) {
        const isMain = (app.professional_id || 'owner') === user.professional_id;
        const isInCombo = app.services && Array.isArray(app.services) && 
                         app.services.some(s => (s.professional_id || 'owner') === user.professional_id);
        
        if (!isMain && !isInCombo) return;
      }

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
    let merged = [...autoReminderNotifications, ...notifications];
    
    // Se for staff, filtra para mostrar apenas notificações referentes a ele
    if (user?.tipo === 'staff' && user?.professional_id) {
      merged = merged.filter(n => {
        // Se a notificação tiver um professional_id vinculado, deve ser o dele
        if (n.professional_id) {
          return n.professional_id === user.professional_id;
        }
        
        // Fallback para notificações de agendamento que ainda não tem professional_id direto na notificação
        // mas podem ter no objeto da mensagem ou meta-dados (se houver)
        // Por enquanto, as novas notificações já salvarão o professional_id.
        // Se não houver ID e for staff, por segurança, não mostramos (ou mantemos apenas se for um lembrete dele)
        if (n.type === 'reminder_24h') return true; // Lembretes 24h já são filtrados na geração
        
        return false;
      });
    }

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
      return appDate >= startOfCurrentMonth && appDate <= endOfCurrentMonth && normalizeStatus(app.status) !== APPOINTMENT_STATUS.CANCELLED;
    }).length;
  }, [allAppointments]);

  const isLimitReached = userPlan === 'bronze' && monthlyAppointmentsCount >= 100;
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, client: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Estados Financeiros
  const [financeMode, setFinanceMode] = useState('salao'); // 'salao' | 'equipe'
  const [teamSelectedProfessionalId, setTeamSelectedProfessionalId] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilter, setFinanceFilter] = useState({
    professionalId: 'all',
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date())
  });
  const [financeTransactions, setFinanceTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', value: '', category: 'Outros', date: format(new Date(), 'yyyy-MM-dd') });
  const [expenseLoading, setExpenseLoading] = useState(false);

  useEffect(() => {
    if (establishment?.settings?.slot_interval) {
      setTempInterval(establishment.settings.slot_interval);
    }
  }, [establishment?.settings?.slot_interval]);

  const handleSaveInterval = async () => {
    if (!establishment?.id) return;
    try {
      setIsSavingInterval(true);
      const estRef = doc(db, 'establishments', establishment.id);
      await updateDoc(estRef, {
        'settings.slot_interval': tempInterval
      });
      showToast(`Grade ajustada para ${tempInterval} minutos!`);
      setShowIntervalEditor(false);
    } catch (error) {
      console.error("Erro ao salvar intervalo:", error);
      showToast("Erro ao salvar configuração.", "error");
    } finally {
      setIsSavingInterval(false);
    }
  };

  useEffect(() => {
    if (financeMode === 'equipe') {
      setTeamSelectedProfessionalId(null);
    }
  }, [financeMode]);

  const loadFinanceData = useCallback(async () => {
    if (!establishment?.id) return;
    try {
      setFinanceLoading(true);
      console.log("Financeiro: Carregando dados para", establishment.id, financeFilter);
      
      // Busca Transações
      const data = await getTransactions(
        establishment.id, 
        financeFilter.startDate, 
        financeFilter.endDate
      );
      setFinanceTransactions(data);

      // Busca Despesas
      const expQuery = query(
        collection(db, "expenses"),
        where("establishment_id", "==", establishment.id)
      );
      const expSnapshot = await getDocs(expQuery);
      const expData = expSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(exp => {
          const expDate = exp.date?.toDate ? exp.date.toDate() : new Date(exp.date);
          return expDate >= financeFilter.startDate && expDate <= financeFilter.endDate;
        });
      setExpenses(expData);

    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
      showToast("Erro ao carregar finanças.", "error");
    } finally {
      setFinanceLoading(false);
    }
  }, [establishment?.id, financeFilter.startDate, financeFilter.endDate]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.value) return;
    try {
      setExpenseLoading(true);
      await addDoc(collection(db, "expenses"), {
        establishment_id: establishment.id,
        description: newExpense.description,
        value: Number(newExpense.value),
        category: newExpense.category,
        date: new Date(newExpense.date),
        createdAt: Timestamp.now()
      });
      showToast("Despesa registrada!");
      setIsExpenseModalOpen(false);
      setNewExpense({ description: '', value: '', category: 'Outros', date: format(new Date(), 'yyyy-MM-dd') });
      loadFinanceData();
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      showToast("Erro ao salvar despesa.", "error");
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setExpenseLoading(true);
      await deleteDoc(doc(db, "expenses", expenseToDelete.id));
      showToast("Despesa excluída com sucesso!");
      setExpenseToDelete(null);
      loadFinanceData();
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      showToast("Erro ao excluir despesa.", "error");
    } finally {
      setExpenseLoading(false);
    }
  };

  const setPeriod = (type) => {
    const now = new Date();
    let start, end;

    switch (type) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    setFinanceFilter(prev => ({ ...prev, startDate: start, endDate: end }));
  };

  const handleMarkAsPaid = async (transactionId) => {
    try {
      await markCommissionAsPaid(transactionId);
      showToast("Comissão marcada como paga!", "success");
      loadFinanceData(); // Recarrega os dados
    } catch (error) {
      console.error("Erro ao pagar comissão:", error);
      showToast("Erro ao processar pagamento.", "error");
    }
  };

  useEffect(() => {
    if (view === 'financas' || (view === 'comissoes' && user?.tipo === 'staff')) {
      if (view === 'comissoes' && user?.tipo === 'staff') {
        setFinanceMode('equipe');
        setTeamSelectedProfessionalId(user.professional_id || 'owner');
      }
      loadFinanceData();
    }
  }, [view, loadFinanceData, user?.tipo, user?.professional_id]);

  // Helper para mostrar notificações
  const showToast = (message, type = 'success') => {
    // Adiciona notificação interna para o Admin se for um cancelamento
    if (message.includes("cancelado") && type === 'success') {
      const professionalId = user?.uid || 'owner';
      const q = query(
        collection(db, "notifications"),
        where("establishment_id", "==", establishment.id),
        where("professional_id", "==", professionalId),
        where("type", "==", "appointment_cancelled"),
        where("read", "==", false)
      );
      // Não precisa fazer nada aqui, o listener de notificações do admin cuidará de mostrar no sino
    }

    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Lógica de Assinatura e Planos
  const subscription = establishment?.subscription || { status: 'trial', trial_ends_at: null };
  const trialEndsAt = safeToDate(subscription.trial_ends_at);
  const isTrialExpired = subscription.status === 'trial' && new Date() > trialEndsAt;
  const daysRemaining = Math.max(0, Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24)));

  const currentPlan = PLANS.find(plan => plan.id === userPlan) || PLANS[0];
  const currentPlanName = currentPlan?.name || 'Essencial';
  const monthlyPlanLimit = userPlan === 'bronze' ? 100 : null;
  const usagePercent = monthlyPlanLimit
    ? Math.min(100, Math.round((monthlyAppointmentsCount / monthlyPlanLimit) * 100))
    : null;
  const hasActiveSubscription = ['active', 'trial', 'cancelled'].includes(establishment?.subscription?.status);
  const recommendedUpgrade =
    userPlan === 'bronze'
      ? PLANS.find(plan => plan.id === 'silver')
      : userPlan === 'silver'
        ? PLANS.find(plan => plan.id === 'gold')
        : null;

  // Sincroniza tempSlug quando o estabelecimento carregar
  useEffect(() => {
    if (establishment?.slug && !tempSlug) {
      setTempSlug(establishment.slug);
    }
  }, [establishment?.slug]);
  const [newService, setNewService] = useState({ 
    nome: '', 
    descricao: '', 
    duracao: 30, 
    preco: '',
    prioridade: 0 // 0: Normal, 1: Alta (Vem primeiro no combo)
  });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Se o perfil não estiver completo, exibe o Onboarding
  // - Contas novas: profile_completed === false
  // - Contas legadas (sem profile_completed): se setup_steps.info_basica === false
  // - forceShowOnboarding=true: usuário clicou em "Finalizar configuração" para rever o wizard
  const isProfileIncomplete = establishment && (
    forceShowOnboarding === true ||
    establishment.profile_completed === false ||
    (
      establishment.profile_completed === undefined &&
      (!establishment.setup_steps || establishment.setup_steps.info_basica === false)
    )
  );

  // Cálculo de progresso do setup steps para o banner
  const SETUP_STEPS_KEYS = ['info_basica', 'logo', 'schedule', 'first_service', 'policy'];
  const setupSteps = establishment?.setup_steps || {};
  const setupCompleted = SETUP_STEPS_KEYS.filter(k => setupSteps[k] === true).length;
  const setupProgressPercent = Math.round((setupCompleted / SETUP_STEPS_KEYS.length) * 100);
  const isSetupIncomplete = setupCompleted < SETUP_STEPS_KEYS.length;

  // L-02: Verifica gaps do cadastro que quebram UX ou lançamento
  // (avisa o admin para não lançar com dados faltando)
  const missingLaunchChecks = (() => {
    const list = [];
    const tel = String(establishment?.telefone || '').replace(/\D/g, '');
    if (!tel || tel.length < 10) list.push({ key: 'tel', label: 'Telefone/WhatsApp inválido', tip: 'Sem ele, o botão de WhatsApp não funciona no minisite.', goto: 'config', cta: 'Corrigir telefone' });
    const slug = establishment?.slug;
    const slugRe = /^[a-z0-9-]+$/;
    if (!slug || !slugRe.test(slug)) list.push({ key: 'slug', label: 'Slug do minisite inválido', tip: 'Use só letras minúsculas, números e "-". Sem acentos, sem espaços.', goto: 'config', cta: 'Corrigir slug' });
    const end = establishment?.endereco;
    if (!end || !String(end.rua || end.logradouro || end || '').trim()) list.push({ key: 'end', label: 'Endereço não cadastrado', tip: 'Clientes não sabem onde é o atendimento presencial.', goto: 'config', cta: 'Adicionar endereço' });
    if (!establishment?.logo_url && !establishment?.photoURL) list.push({ key: 'logo', label: 'Logo/Foto não cadastrada', tip: 'Marca forte = mais agendamentos no minisite.', goto: 'config', cta: 'Enviar logo' });
    if (!services || services.length === 0) list.push({ key: 'svc', label: 'Nenhum serviço cadastrado', tip: 'Sem serviços, ninguém consegue agendar.', goto: 'servicos', cta: 'Cadastrar serviços' });
    if (!allProfessionals || allProfessionals.length === 0) list.push({ key: 'team', label: 'Nenhum profissional cadastrado', tip: 'Sem profissional, serviços não têm horário disponível.', goto: 'equipe', cta: 'Adicionar equipe' });
    const bs = businessSettings || {};
    if (!bs.horario_inicio || !bs.horario_fim) list.push({ key: 'sched', label: 'Horário de atendimento padrão não configurado', tip: 'Sem horário, a busca de vagas não funciona.', goto: 'horarios', cta: 'Configurar horários' });
    return list;
  })();
  const missingLaunchCount = missingLaunchChecks.length;
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
      let apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log("Firestore: Total de agendamentos recebidos:", apps.length);
      setAllAppointments(apps);
    }, (error) => {
      console.error("Erro na escuta de agendamentos:", error);
    });

    return () => unsubscribe();
  }, [establishment?.id, user?.tipo, user?.professional_id]);

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

  // ESCUTA EM TEMPO REAL: Equipe
  useEffect(() => {
    if (!establishment?.id) return;

    const q = query(
      collection(db, "professionals"),
      where("establishment_id", "==", establishment.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamData = snapshot.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          ...data,
          // Normaliza o campo de email para evitar 'undefined' se foi salvo com chaves diferentes no passado
          email: data.email || data['e-mail'] || data.e_mail || ''
        };
      });
      setTeam(teamData);
    }, (error) => {
      console.error("Erro na escuta da equipe:", error);
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

  // Filtragem da agenda sempre que a data selecionada, filtro de profissional ou a lista total mudar
  useEffect(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    let filtered = allAppointments
      .filter(app => {
        // Garantir que temos um objeto Date válido para comparar
        const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
        const isInDay = appDate >= dayStart && appDate <= dayEnd;
        
        // Se for membro da equipe (staff), mostrar apenas seus próprios agendamentos na UI
        if (user?.tipo === 'staff' && user?.professional_id) {
          const isMain = (app.professional_id || 'owner') === user.professional_id;
          const isInCombo = app.services && Array.isArray(app.services) && 
                           app.services.some(s => (s.professional_id || 'owner') === user.professional_id);
          
          if (!isMain && !isInCombo) return false;
        }

        // Filtro por profissional (selecionado no topo da agenda)
        if (professionalFilter === 'all') return isInDay;
        
        // Verifica se é um combo com múltiplos profissionais
        const hasProfessionalInCombo = app.services && Array.isArray(app.services) && 
          app.services.some(s => s.professional_id === professionalFilter);
        
        if (hasProfessionalInCombo) return isInDay;

        // Fallback para agendamentos simples ou legados
        const appProfessionalId = app.professional_id || 'owner';
        return isInDay && appProfessionalId === professionalFilter;
      });

    filtered.sort((a, b) => {
      const dateA = a.data_hora?.toDate ? a.data_hora.toDate() : new Date(a.data_hora);
      const dateB = b.data_hora?.toDate ? b.data_hora.toDate() : new Date(b.data_hora);
      return dateA - dateB;
    });

    console.log("Agenda: Filtrando para", format(selectedDate, 'dd/MM/yyyy'), "| Profissional:", professionalFilter, "| Encontrados:", filtered.length);
    setAppointments(filtered);
  }, [selectedDate, allAppointments, professionalFilter, user?.tipo, user?.professional_id]);

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
        preco: Number(newService.preco),
        prioridade: Number(newService.prioridade || 0)
      };

      if (editingServiceId) {
        await updateDoc(doc(db, "services", editingServiceId), servicePayload);
      } else {
        await addDoc(collection(db, "services"), {
          ...servicePayload,
          createdAt: Timestamp.now()
        });
      }

      setNewService({ nome: '', descricao: '', duracao: 30, preco: '', prioridade: 0 });
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
      preco: service.preco || '',
      prioridade: service.prioridade || 0
    });
    setIsServiceModalOpen(true);
  }

  function resetServiceForm() {
    setEditingServiceId(null);
    setNewService({ nome: '', descricao: '', duracao: 30, preco: '', prioridade: 0 });
    setIsServiceModalOpen(false);
  }

  async function handleCancelAppointment(id) {
    try {
      setLoading(true);
      const appRef = doc(db, "appointments", id);
      const appSnap = await getDoc(appRef);
      const appData = appSnap.exists() ? { id: appSnap.id, ...appSnap.data() } : null;

      if (!appData) {
        showToast("Agendamento não encontrado.", "error");
        return;
      }

      // B-11: Snapshot profundo antes do cancelamento para UNDO
      // (JSON.parse + stringify remove referências a objetos Firestore
      //  e previne que campos Timestamp sejam atualizados por acidente depois.)
      const snapshotForUndo = JSON.parse(JSON.stringify({
        id: appData.id,
        status_before: appData.status,
        raw: appSnap.data()
      }));
      undoLastCancelRef.current = { appointmentId: id, snapshot: snapshotForUndo, ts: Date.now() };

      await updateDoc(appRef, {
        status: 'cancelled',
        cancelled_at: Timestamp.now(),
        cancelled_by: user?.uid || 'admin',
        cancelled_via: 'admin_dashboard'
      });

      // Notificação para o cliente
      if (appData.user_id && appData.user_id !== 'manual') {
        const servicesLabel = appData.service_nome || (appData.services && Array.isArray(appData.services) && appData.services.length > 0
          ? appData.services.map(s => s.nome).join(' + ')
          : 'Serviço');

        await createClientNotification(
          establishment.id,
          appData.user_id,
          'appointment_cancelled',
          'Agendamento Cancelado ❌',
          `Seu agendamento de ${servicesLabel} foi cancelado pela estética.`,
          appData.id,
          'admin-cancelled'
        );
      }

      // Notificação para o Administrador (Interna)
      await createAppointmentEventNotification({
        establishment_id: establishment.id,
        targetProfessionalId: appData.professional_id || 'owner',
        type: 'appointment_cancelled',
        title: 'Agendamento Cancelado ❌',
        message: `${appData.user_nome} - O agendamento de ${appData.service_nome || 'Serviço'} foi cancelado.`,
        appointment_id: appData.id,
        extra: 'admin'
      });

      setIsAppDetailsModalOpen(false);
      setPendingCancelUndo({ appointmentId: id, expiresAt: Date.now() + 120000, ts: Date.now() });
      showToast("Agendamento cancelado! 2 minutos para desfazer 💖", "success");
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      showToast("Erro ao cancelar agendamento.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Countdown regressivo para o banner do UNDO (1s tick, limpa quando expira)
  React.useEffect(() => {
    if (!pendingCancelUndo) return;
    const t = setInterval(() => {
      const remaining = pendingCancelUndo.expiresAt - Date.now();
      if (remaining <= 0) {
        setPendingCancelUndo(null);
        undoLastCancelRef.current = null;
      } else {
        forceUndoTick(x => x + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [pendingCancelUndo]);

  async function handleUndoCancelAppointment() {
    if (!undoLastCancelRef.current) return;
    const { appointmentId, snapshot } = undoLastCancelRef.current;
    if (!appointmentId || !snapshot) return;
    try {
      setLoading(true);
      const prevStatusRaw = snapshot.status_before;
      const prevStatus = prevStatusRaw && prevStatusRaw !== 'cancelled'
        ? prevStatusRaw
        : APPOINTMENT_STATUS.SCHEDULED;

      const restorePayload = {
        status: prevStatus,
        cancelled_at: null,
        cancelled_by: null,
        cancelled_via: null,
        undo_cancel: true,
        undo_cancel_at: Timestamp.now(),
        undo_cancel_by: user?.uid || 'admin'
      };

      await updateDoc(doc(db, "appointments", appointmentId), restorePayload);
      showToast("Voltamos o agendamento ao status original 💖", "success");
      setPendingCancelUndo(null);
      undoLastCancelRef.current = null;
    } catch (error) {
      console.error("Erro ao desfazer cancelamento:", error);
      showToast("Não consegui desfazer. Edite manualmente o agendamento.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteAppointment(id, paymentMethod = 'pix') {
    try {
      setLoading(true);
      const appRef = doc(db, "appointments", id);
      const appSnap = await getDoc(appRef);
      const appData = appSnap.exists() ? { id: appSnap.id, ...appSnap.data() } : null;

      if (!appData) throw new Error("Agendamento não encontrado.");

      await updateDoc(appRef, { status: APPOINTMENT_STATUS.COMPLETED });

        // NOVO: Registra a transação financeira passando o ID da estética atual para garantir
        try {
          console.log("Financeiro: Registrando transação para agendamento concluído:", appData);
          await recordAppointmentTransaction(appData, establishment.id, paymentMethod);
          
          // Se a pessoa já estiver na aba finanças, atualiza os dados na hora
          if (view === 'financas') {
            // Pequeno delay para garantir que o Firestore indexou a nova transação
            setTimeout(() => {
              loadFinanceData();
            }, 1000);
          }
        } catch (financeError) {
        console.error("Erro ao registrar financeiro, mas o agendamento foi concluído:", financeError);
      }

      // Notificação para o cliente
      if (appData?.user_id) {
        await createClientNotification(
          establishment.id,
          appData.user_id,
          'appointment_completed',
          'Atendimento Finalizado! ✨',
          `Sua sessão de ${appData.service_nome || 'Serviço'} foi concluída. Esperamos que tenha amado!`,
          appData.id,
          'done'
        );
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

  async function handleSaveManualAppointment(e) {
    e.preventDefault();
    if (!manualAppData.user_nome || !manualAppData.service_id || !manualAppData.professional_id || !manualAppData.data_hora) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    try {
      setIsSavingManualApp(true);
      const service = services.find(s => s.id === manualAppData.service_id);
      const professional = allProfessionals.find(p => p.id === manualAppData.professional_id);

      if (!service || !professional) {
        showToast("Dados de serviço ou profissional ainda carregando, tente novamente em 1s.", "error");
        return;
      }

      const appPayload = {
        establishment_id: establishment.id,
        establishment_name: establishment.nome,
        user_id: 'manual',
        user_nome: manualAppData.user_nome,
        user_telefone: manualAppData.user_telefone,
        services: [{
          id: service.id,
          nome: service.nome,
          duracao: Number(service.duracao),
          preco: Number(service.preco),
          professional_id: manualAppData.professional_id,
          professional_nome: professional.nome,
          start_time: new Date(manualAppData.data_hora),
          end_time: addMinutes(new Date(manualAppData.data_hora), Number(service.duracao))
        }],
        service_id: manualAppData.service_id,
        service_nome: service.nome,
        preco: Number(service.preco),
        total_price: Number(service.preco),
        duration: Number(service.duracao),
        total_duration: Number(service.duracao),
        professional_id: manualAppData.professional_id,
        professional_nome: professional.nome,
        data_hora: new Date(manualAppData.data_hora),
        status: 'confirmado',
        tipo: 'manual'
      };

      await createAppointment(appPayload);
      
      // Se for uma remarcação, cancela o agendamento de origem
      if (remarcacaoOrigem) {
        const oldAppRef = doc(db, "appointments", remarcacaoOrigem);
        const oldAppSnap = await getDoc(oldAppRef);
        const oldAppData = oldAppSnap.exists() ? { id: oldAppSnap.id, ...oldAppSnap.data() } : null;

        await updateDoc(oldAppRef, { 
          status: 'cancelled',
          remarcado_para: manualAppData.data_hora 
        });

        // Notifica cliente da remarcação
        if (oldAppData && oldAppData.user_id && oldAppData.user_id !== 'manual') {
          await createClientNotification(
            establishment.id,
            oldAppData.user_id,
            'appointment_rescheduled',
            'Horário Alterado 📅',
            `Seu agendamento para ${oldAppData.service_nome || 'Serviço'} foi alterado para ${format(new Date(manualAppData.data_hora), "dd/MM 'às' HH:mm")}.`
          );
        }

        // Notifica Admin do cancelamento do antigo
        if (oldAppData) {
          await createAppointmentEventNotification({
            establishment_id: establishment.id,
            targetProfessionalId: oldAppData.professional_id || 'owner',
            type: 'appointment_rescheduled',
            title: 'Agendamento Remarcado 📅',
            message: `${oldAppData.user_nome} - O horário antigo de ${oldAppData.service_nome || 'Serviço'} foi cancelado pois foi remarcado.`,
            appointment_id: oldAppData.id,
            extra: 'old-cancelled'
          });
        }

        setRemarcacaoOrigem(null);
        showToast("Agendamento antigo cancelado e novo criado!");
      } else {
        // Também adiciona à lista de clientes manuais se for um novo cliente (apenas agendamentos novos)
        const clientExists = manualClients.some(c => c.telefone === manualAppData.user_telefone);
        if (!clientExists && manualAppData.user_telefone) {
          await addDoc(collection(db, 'manual_clients'), {
            establishment_id: establishment.id,
            nome: manualAppData.user_nome,
            telefone: manualAppData.user_telefone,
            lastVisit: Timestamp.now(),
            createdAt: Timestamp.now()
          });
        }
        showToast("Agendamento realizado com sucesso!");
      }

      setIsManualAppModalOpen(false);
      setManualAppData({ 
        user_nome: '', 
        user_telefone: '', 
        service_id: '', 
        professional_id: '', 
        data_hora: format(new Date(), "yyyy-MM-dd'T'HH:mm")
      });
    } catch (error) {
      console.error("Erro ao salvar agendamento manual:", error);
      if (error.code === 'SLOT_TAKEN') {
        showToast("Este horário já foi preenchido por outra pessoa.", "error");
      } else {
        showToast("Erro ao agendar.", "error");
      }
    } finally {
      setIsSavingManualApp(false);
    }
  }

  async function handleUploadProfessionalPhoto(file, professionalId) {
    if (!file || !professionalId) return;
    try {
      setProfessionalPhotoUploading(professionalId);
      const filePath = `professionals/${professionalId}/photo-${Date.now()}`;
      const url = await uploadToSupabase(file, 'bellizyuplo', filePath);
      
      await updateDoc(doc(db, 'professionals', professionalId), { foto: url });
      
      // Se for a própria dona alterando sua foto, também atualiza o profileInfo
      if (professionalId === 'owner') {
        await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
        await updateDoc(doc(db, 'establishments', establishment.id), { photoURL: url });
        setProfileInfo(prev => ({ ...prev, photoURL: url }));
      }
      
      showToast('Foto do profissional atualizada!');
    } catch (error) {
      console.error('Erro ao enviar foto do profissional:', error);
      showToast('Erro no upload.', 'error');
    } finally {
      setProfessionalPhotoUploading(null);
    }
  }

  const { updateUserPassword } = useAuth();
  
  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("As senhas não coincidem.", "error");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showToast("A senha deve ter no menos 6 caracteres.", "error");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await updateUserPassword(passwordData.newPassword, passwordData.currentPassword);

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast("Senha atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      if (error.code === 'auth/requires-recent-login') {
        showToast("Para sua segurança, faça login novamente antes de alterar a senha.", "error");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showToast("Senha atual incorreta.", "error");
      } else {
        showToast("Erro ao atualizar senha.", "error");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  // Funções da Aba Equipe
  function handleEditTeamMember(member) {
    setEditingMemberId(member.id);
    setShowTeamPassword(false);
    setCreatedCredentials(null); // Garante que não mostre a tela de sucesso
    setNewMember({
      nome: member.nome || '',
      cargo: member.cargo || '',
      foto: member.foto || '',
      servicos: member.servicos || [],
      email: member.email || '',
      password: '',
      commission_percentage: member.commission_percentage || 0,
      break_time: member.break_time || { enabled: false, start: '12:00', end: '13:00' }
    });
    setIsTeamModalOpen(true);
  }

  async function handleSaveTeamMember(e) {
    e.preventDefault();
    if (!newMember.nome || !newMember.cargo) {
      showToast("Nome e cargo são obrigatórios.", "error");
      return;
    }

    try {
      setIsSavingMember(true);
      
      if (editingMemberId) {
        // Lógica de Edição
        const memberRef = doc(db, "professionals", editingMemberId);
        const updatePayload = {
          nome: newMember.nome,
          cargo: newMember.cargo,
          servicos: newMember.servicos,
          commission_percentage: Number(newMember.commission_percentage || 0),
          break_time: newMember.break_time // Salva a configuração de pausa
        };
        
        await updateDoc(memberRef, updatePayload);

        // Se o profissional tiver um auth_uid (conta vinculada), atualiza o nome na coleção users também
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists() && memberSnap.data().auth_uid) {
          await updateDoc(doc(db, "users", memberSnap.data().auth_uid), {
            nome: newMember.nome
          });
        }

        showToast("Profissional atualizado com sucesso!");
        setIsTeamModalOpen(false);
        setEditingMemberId(null);
        setNewMember({ nome: '', cargo: '', foto: '', servicos: [], email: '', password: '' });
      } else {
        // Lógica de Criação (já existente)
        const result = await createManagedStaffAccount(newMember, establishment);
        
        if (result.success) {
          setCreatedCredentials({
            nome: newMember.nome,
            email: result.email,
            password: result.password
          });
          
          setNewMember({ nome: '', cargo: '', foto: '', servicos: [], email: '', password: '' });
          showToast("Conta profissional criada com sucesso!");
        }
      }
    } catch (error) {
      console.error("Erro ao salvar membro da equipe:", error);
      showToast(error.message || "Erro ao salvar membro.", "error");
    } finally {
      setIsSavingMember(false);
    }
  }

  async function handleDeleteTeamMember(id, memberEmail) {
    if (!window.confirm(`Remover este profissional da equipe? Ele perderá acesso ao painel imediatamente.`)) return;
    try {
      await deleteManagedStaffAccount(id, memberEmail);
      showToast("Profissional removido e acesso revogado.");
    } catch (error) {
      console.error("Erro ao remover profissional:", error);
      showToast("Erro ao remover.", "error");
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
    if (user?.tipo === 'staff') {
      showToast("Apenas a Dona pode alterar o link do estabelecimento.", "error");
      return;
    }
    if (!establishment?.id) return;
    if (!slugStatus.available || slugStatus.checking) return;
    if (!isSlugDirty) return;

    try {
      setSlugSaving(true);
      const cleanSlug = sanitizeSlug(tempSlug);
      await updateDoc(doc(db, 'establishments', establishment.id), { slug: cleanSlug });
      setSlugSaved(true);
      showToast('Link atualizado com sucesso!');
      setTimeout(() => setSlugSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar link:', error);
      setSlugSaved(false);
      showToast('Erro ao salvar link.', 'error');
    } finally {
      setSlugSaving(false);
    }
  };

  async function saveSettings(e) {
    if (e) e.preventDefault();
    
    if (user?.tipo !== 'staff' && !validatePhone(profileInfo.telefone)) {
      showToast("Por favor, insira um WhatsApp válido com DDD.", "error");
      return;
    }

    try {
      setLoading(true);

      if (user?.tipo === 'staff') {
        // Se for staff, salva apenas os dados dele no perfil de usuário e na coleção professionals
        const userUpdate = {
          nome: profileInfo.professionalName,
          photoURL: profileInfo.photoURL
        };
        await updateDoc(doc(db, 'users', user.uid), userUpdate);
        
        if (user.professional_id) {
          await updateDoc(doc(db, 'professionals', user.professional_id), {
            nome: profileInfo.professionalName,
            foto: profileInfo.photoURL
          });
        }
        
        showToast('Seu perfil profissional foi atualizado!');
      } else {
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
      }
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

  // Filtra profissionais ativos (Dona + Equipe)
  const allProfessionals = useMemo(() => {
    const owner = {
      id: 'owner',
      nome: profileInfo.nome || 'Especialista Principal',
      cargo: 'Admin Master',
      foto: profileInfo.photoURL || profileInfo.logo_url || ''
    };
    return [owner, ...team];
  }, [profileInfo, team]);

  // Processamento da Lista de Clientes
  const clientsList = useMemo(() => {
    const clientsMap = {};
    const estId = establishment?.id;

    allAppointments.forEach(app => {
      if (app.hidden_from_list) return;
      if (estId && app.establishment_id !== estId) return;

      const nome = app.user_nome || app.userName || app.userNome || 'Cliente sem nome';
      const telefone = app.user_telefone || app.user_phone || app.userPhone || app.userTelefone || '';
      const email = app.user_email || app.userEmail || app.userEmailAddress || '';
      const photoURL = app.user_avatar || app.userPhoto || app.userPhotoURL || '';

      const clientId = `${estId || 'global'}__${app.user_id || app.user_uid || email || telefone || nome}`;
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
  }, [allAppointments, manualClients, searchTerm, establishment]);

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
      
      // Se for um membro da equipe, também atualiza o documento dele na coleção 'professionals'
      if (user.tipo === 'staff' && user.professional_id) {
        await updateDoc(doc(db, 'professionals', user.professional_id), { foto: url });
      }
      
      // Se for admin, também atualiza o documento do estabelecimento para o Mini Site
      if (user.tipo === 'admin' && establishment?.id) {
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

    // L-03: Validações de deduplicação antes de gravar
    const cleanTel = String(newClient.telefone || '').replace(/\D/g, '');
    if (cleanTel.length < 10) {
      showToast("Telefone inválido (precisa ter DDD + número).", "error");
      return;
    }

    const sameTelManual = (manualClients || []).find(c =>
      c && String(c.telefone || '').replace(/\D/g, '') === cleanTel
    );
    const sameTelGlobal = (clientsList || []).find(c =>
      c && String(c.telefone || '').replace(/\D/g, '') === cleanTel
    );
    const existingClient = sameTelManual || sameTelGlobal;

    // CPF/CNPJ: se o usuário preencheu, avisa sobre duplicado mas não bloqueia
    // (campo CPF atualmente não existe em newClient; preparado para futuro)
    const rawCpf = String(newClient.cpf_cnpj || newClient.cpf || '').replace(/\D/g, '');
    const sameDoc = rawCpf && (rawCpf.length === 11 || rawCpf.length === 14) && (
      (manualClients || []).some(c => c && String(c.cpf_cnpj || c.cpf || '').replace(/\D/g, '') === rawCpf) ||
      (clientsList || []).some(c => c && String(c.cpf_cnpj || c.cpf || '').replace(/\D/g, '') === rawCpf)
    );

    if (existingClient) {
      showToast(`Já existe uma cliente com esse telefone: ${existingClient.nome}. Use "Editar" em vez de cadastrar nova.`, "error");
      return;
    }
    if (sameDoc) {
      const ok = window.confirm("Atenção: já existe uma cliente com esse CPF/CNPJ. Deseja continuar mesmo assim?");
      if (!ok) return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "manual_clients"), {
        ...newClient,
        nome: newClient.nome.trim(),
        telefone: newClient.telefone,
        telefone_clean: cleanTel,
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
        await updateDoc(doc(db, "manual_clients", client.uid), {
          notes: editingNote.text
        });
      } else {
        const batch = writeBatch(db);
        client.appointments.forEach(app => {
          if (app.establishment_id === establishment?.id) {
            batch.update(doc(db, "appointments", app.id), { user_notes: editingNote.text });
          }
        });
        
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

  if (loading || !user || ((user.tipo === 'admin' || user.tipo === 'staff') && !establishment)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
        <p className="text-primary-600 font-medium italic animate-pulse">Musa Agenda...</p>      </div>
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
        onClick={() => setView('planos_assinatura')}
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
    <SubscriptionGuard establishment={establishment} setView={setView}>
      <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50">
        
        {/* Sidebar Desktop (Fixa) */}
      <aside className="hidden md:block w-72 bg-white border-r border-pink-100 sticky top-0 h-screen overflow-hidden shrink-0">
        <SidebarContent 
          view={view} 
          setView={setView} 
          logout={handleLogout}
          establishment={establishment}
          profileInfo={profileInfo}
          userRole={user?.tipo}
        />
      </aside>

      {/* Navegação Mobile */}
      <MobileTopbar 
        onMenuClick={() => setIsMenuOpen(true)} 
        title="Musa Agenda"
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
        logout={handleLogout}
        establishment={establishment}
        profileInfo={profileInfo}
        userRole={user?.tipo}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 pb-12 md:pb-10 max-w-6xl mx-auto w-full overflow-y-auto relative">
        
        {/* Top Header Barra de Ações (Sininho, Perfil, etc) */}
        <div className="flex items-center justify-between mb-8 hidden md:flex">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 md:hidden">
              <Store size={20} />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase md:hidden">Musa Agenda</h1>
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
          <div className={`mb-6 p-4 sm:p-5 rounded-3xl border-2 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden ${
            isTrialExpired
              ? 'bg-red-50 border-red-200 text-red-700'
              : daysRemaining <= 3
                ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 text-red-700 shadow-lg shadow-red-100/60'
                : 'bg-gradient-to-br from-pink-50 to-rose-50/40 border-pink-100 text-pink-700 shadow-sm'
          } ${daysRemaining <= 3 && !isTrialExpired ? 'animate-pulse' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className={`relative shrink-0 ${isTrialExpired ? '' : daysRemaining <= 3 ? 'animate-bounce' : ''}`}>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-inner ${
                    isTrialExpired
                      ? 'bg-red-100'
                      : daysRemaining <= 3
                        ? 'bg-red-100 text-red-700'
                        : 'bg-white text-pink-600'
                  }`}>
                    {isTrialExpired
                      ? <ShieldAlert size={26} />
                      : daysRemaining <= 3
                        ? <Clock size={26} />
                        : <Gift size={26} />}
                  </div>
                  {!isTrialExpired && daysRemaining > 0 && (
                    <div className={`absolute -top-2 -right-2 min-w-[36px] h-8 px-2 rounded-full flex items-center justify-center font-black text-sm text-white shadow-md ${
                      daysRemaining <= 3 ? 'bg-red-600' : 'bg-pink-600'
                    }`}>
                      {daysRemaining}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm sm:text-base font-black uppercase tracking-wider leading-tight mb-1 ${
                    daysRemaining <= 3 && !isTrialExpired ? 'text-red-700' : ''
                  }`}>
                    {isTrialExpired
                      ? '⏰ Teste Grátis Expirado'
                      : daysRemaining <= 3
                        ? `⚡ Corre! Só restam ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}!`
                        : '🎁 Período de Experiência Ativo'}
                  </p>
                  <p className="text-xs sm:text-sm font-bold opacity-85 leading-relaxed">
                    {isTrialExpired
                      ? 'Assine agora para continuar recebendo agendamentos e usando todas as funcionalidades.'
                      : daysRemaining > 0
                        ? `Você tem ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'} de acesso TOTAL ao plano Profissional (Silver) de graça.`
                        : 'Expira hoje! Aproveite as últimas horas.'}
                  </p>

                  {/* Progresso do Setup: mostra se ainda faltam passos */}
                  {!isTrialExpired && isSetupIncomplete && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                          Configuração do espaço
                        </span>
                        <span className="text-xs font-black tabular-nums">
                          {setupCompleted}/{SETUP_STEPS_KEYS.length} · {setupProgressPercent}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/70 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            setupProgressPercent >= 80 ? 'bg-emerald-500' : setupProgressPercent >= 40 ? 'bg-amber-500' : 'bg-pink-500'
                          }`}
                          style={{ width: `${setupProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 sm:flex-col sm:gap-2 sm:w-auto sm:min-w-[160px]">
                {!isTrialExpired && isSetupIncomplete && (
                  <button
                    onClick={() => {
                      setForceShowOnboarding(true);
                    }}
                    className="flex-1 sm:flex-none px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 bg-white text-pink-700 border-2 border-white/60 hover:bg-pink-50 shadow-sm flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} />
                    {setupCompleted === 0 ? 'Começar configuração' : 'Finalizar configuração'}
                  </button>
                )}
                {view !== 'assinatura' && (
                  <button
                    onClick={() => setView('planos_assinatura')}
                    className={`flex-1 sm:flex-none px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md ${
                      isTrialExpired
                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                        : daysRemaining <= 3
                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                          : 'bg-pink-600 text-white hover:bg-pink-700 shadow-pink-200'
                    }`}
                  >
                    <Crown size={14} />
                    {isTrialExpired ? 'Ver Planos' : daysRemaining <= 3 ? 'Garantir meu plano' : 'Aproveitar oferta'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: OVERVIEW */}
        {view === 'overview' && (
          <>
            {/* L-02: Banner "pronto para lançar?" — mostra dados incompletos ANTES do overview para o dono ver de primeira */}
            {missingLaunchCount > 0 && (
              <div className="mb-6 rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 sm:p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-inner text-amber-600">
                      <AlertCircle size={26} />
                    </div>
                    <div className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center shadow-md">
                      {missingLaunchCount}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <p className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-900 leading-tight mb-1">
                        ⚠️ {missingLaunchCount === 1 ? 'Falta 1 ajuste antes do lançamento' : `Faltam ${missingLaunchCount} ajustes antes de lançar`}
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-amber-800/80 leading-relaxed">
                        Estes problemas vão reduzir suas conversões ou quebrar o agendamento das clientes. Ajuste todos antes de divulgar.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {missingLaunchChecks.map(item => (
                        <div key={item.key} className="rounded-2xl bg-white/80 border border-amber-200/70 p-3 flex items-start gap-3">
                          <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shadow-inner">
                            !
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-900 leading-tight">{item.label}</p>
                            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{item.tip}</p>
                            <button
                              onClick={() => setView(item.goto)}
                              className="mt-2 inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1.5 transition-all active:scale-95 shadow-sm"
                            >
                              <ChevronRight size={12} />
                              {item.cta}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <OverviewSection
              currentSlug={currentSlug}
              handleCopyLink={handleCopyLink}
              isCopied={isCopied}
              allAppointments={allAppointments}
              establishment={establishment}
              allProfessionals={allProfessionals}
              handleUpdateAppointment={handleUpdateAppointment}
              handleConfirmReschedule={handleConfirmReschedule}
            />
          </>
        )}

        {/* VIEW: FINANCAS OU COMISSOES (STAFF) */}
        {(view === 'financas' || view === 'comissoes') && (
          <FinancasSection
            view={view}
            hasAccess={hasAccess}
            userPlan={userPlan}
            user={user}
            establishment={establishment}
            allProfessionals={allProfessionals}
            team={team}
            financeMode={financeMode}
            setFinanceMode={setFinanceMode}
            setIsExpenseModalOpen={setIsExpenseModalOpen}
            setView={setView}
            loadFinanceData={loadFinanceData}
            financeLoading={financeLoading}
            financeFilter={financeFilter}
            setPeriod={setPeriod}
            financeTransactions={financeTransactions}
            handleMarkAsPaid={handleMarkAsPaid}
            expenses={expenses}
            setExpenseToDelete={setExpenseToDelete}
            setTeamSelectedProfessionalId={setTeamSelectedProfessionalId}
            teamSelectedProfessionalId={teamSelectedProfessionalId}
          />
        )}

        {/* VIEW: RELATORIOS (PLANO GOLD) */}
        {view === 'relatorios' && (
          <RelatoriosSection
            hasAccess={hasAccess}
            setView={setView}
            setIsReportModalOpen={setIsReportModalOpen}
            setPeriod={setPeriod}
            financeTransactions={financeTransactions}
            allAppointments={allAppointments}
            clientsList={clientsList}
          />
        )}

        {/* VIEW: MINISITE (VISUAL DO SITE) */}
        {view === 'minisite' && (
          <MinisiteSection
            showMobilePreview={showMobilePreview}
            setShowMobilePreview={setShowMobilePreview}
            openSection={openSection}
            setOpenSection={setOpenSection}
            LAYOUTS={LAYOUTS}
            PALETTES={PALETTES}
            userPlan={userPlan}
            minisiteSettings={minisiteSettings}
            setMinisiteSettings={setMinisiteSettings}
            showToast={showToast}
            setView={setView}
            saveMinisiteSettings={saveMinisiteSettings}
            loading={loading}
            establishment={establishment}
            profileInfo={profileInfo}
            services={services}
          />
        )}

        {/* VIEW: ASSINATURA (SaaS) e PLANOS */}
        {(view === 'assinatura' || view === 'planos_assinatura') && (
          <AssinaturaSection
            view={view}
            hasActiveSubscription={hasActiveSubscription}
            currentPlan={currentPlan}
            currentPlanName={currentPlanName}
            establishment={establishment}
            setView={setView}
            setIsCancelSubscriptionModalOpen={setIsCancelSubscriptionModalOpen}
            monthlyPlanLimit={monthlyPlanLimit}
            monthlyAppointmentsCount={monthlyAppointmentsCount}
            usagePercent={usagePercent}
            recommendedUpgrade={recommendedUpgrade}
            PLANS={PLANS}
            userPlan={userPlan}
            user={user}
            showToast={showToast}
          />
        )}

        {/* VIEW: EQUIPE */}
        {view === 'equipe' && (
          <EquipeSection
            hasAccess={hasAccess}
            userPlan={userPlan}
            PLANS={PLANS}
            team={team}
            profileInfo={profileInfo}
            user={user}
            showToast={showToast}
            setView={setView}
            setEditingMemberId={setEditingMemberId}
            setNewMember={setNewMember}
            setIsTeamModalOpen={setIsTeamModalOpen}
            handleUploadProfessionalPhoto={handleUploadProfessionalPhoto}
            professionalPhotoUploading={professionalPhotoUploading}
            handleEditTeamMember={handleEditTeamMember}
            handleDeleteTeamMember={handleDeleteTeamMember}
          />
        )}

        {/* VIEW: CLIENTES */}
        {view === 'clientes' && (
          <ClientesSection
            user={user}
            clientsList={clientsList}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setIsClientModalOpen={setIsClientModalOpen}
            visibleClientsCount={visibleClientsCount}
            setVisibleClientsCount={setVisibleClientsCount}
            expandedClientId={expandedClientId}
            setExpandedClientId={setExpandedClientId}
            setActiveClientTab={setActiveClientTab}
            setClientAnamnesis={setClientAnamnesis}
            setSelectedClientAnamnesis={setSelectedClientAnamnesis}
            setLoadingClientAnamnesis={setLoadingClientAnamnesis}
            activeClientTab={activeClientTab}
            clientAnamnesis={clientAnamnesis}
            loadingClientAnamnesis={loadingClientAnamnesis}
            selectedClientAnamnesis={selectedClientAnamnesis}
            editingNote={editingNote}
            setEditingNote={setEditingNote}
            handleSaveNote={handleSaveNote}
            isSavingNote={isSavingNote}
            allProfessionals={allProfessionals}
            establishment={establishment}
            setDeleteConfirmModal={setDeleteConfirmModal}
            anamnesisTemplates={anamnesisTemplates}
            setAnamnesisTemplates={setAnamnesisTemplates}
            setAnamnesisCustomerId={setAnamnesisCustomerId}
            setIsSelectingTemplate={setIsSelectingTemplate}
          />
        )}

        {/* VIEW: AGENDA */}
        {view === 'agenda' && (
          <AgendaSection
            user={user}
            agendaView={agendaView}
            setAgendaView={setAgendaView}
            professionalFilter={professionalFilter}
            setProfessionalFilter={setProfessionalFilter}
            allProfessionals={allProfessionals}
            allAppointments={allAppointments}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            setManualAppData={setManualAppData}
            setIsManualAppModalOpen={setIsManualAppModalOpen}
            appointments={appointments}
            setSelectedApp={setSelectedApp}
            setIsAppDetailsModalOpen={setIsAppDetailsModalOpen}
            handleCancelAppointment={handleCancelAppointment}
          />
        )}

        {/* VIEW: HORARIOS */}
        {view === 'horarios' && (
          <HorariosSection
            showWeeklyEditor={showWeeklyEditor}
            showIntervalEditor={showIntervalEditor}
            setShowWeeklyEditor={setShowWeeklyEditor}
            setShowIntervalEditor={setShowIntervalEditor}
            establishment={establishment}
            tempInterval={tempInterval}
            setTempInterval={setTempInterval}
            handleSaveInterval={handleSaveInterval}
            isSavingInterval={isSavingInterval}
          />
        )}

        {/* VIEW: ANAMNESE */}
        {view === 'anamnese' && (
          <AnamneseSection
            establishment={establishment}
            user={user}
            allAppointments={allAppointments}
          />
        )}

        {/* VIEW: LEMBRETES */}
        {view === 'lembretes' && (
          <LembretesSection
            establishment={establishment}
            allAppointments={allAppointments}
          />
        )}

        {/* VIEW: SERVICOS */}
        {view === 'servicos' && (
          <ServicosSection
            services={services}
            user={user}
            setEditingServiceId={setEditingServiceId}
            setNewService={setNewService}
            setIsServiceModalOpen={setIsServiceModalOpen}
            handleEditService={handleEditService}
            handleDeleteService={handleDeleteService}
          />
        )}

        {/* VIEW: CONFIG */}
        {view === 'config' && (
          <ConfigSection
            user={user}
            team={team}
            openConfigSection={openConfigSection}
            setOpenConfigSection={setOpenConfigSection}
            publicLink={publicLink}
            handleCopyLink={handleCopyLink}
            tempSlug={tempSlug}
            setTempSlug={setTempSlug}
            sanitizeSlug={sanitizeSlug}
            slugStatus={slugStatus}
            isSlugDirty={isSlugDirty}
            slugSaving={slugSaving}
            slugSaved={slugSaved}
            handleSaveSlug={handleSaveSlug}
            saveSettings={saveSettings}
            profileInfo={profileInfo}
            setProfileInfo={setProfileInfo}
            handleUploadLogo={handleUploadLogo}
            logoUploading={logoUploading}
            isPolicyOpen={isPolicyOpen}
            setIsPolicyOpen={setIsPolicyOpen}
            establishment={establishment}
            handleUpdatePassword={handleUpdatePassword}
            passwordData={passwordData}
            setPasswordData={setPasswordData}
            isUpdatingPassword={isUpdatingPassword}
            DESCRIPTION_LIMIT={DESCRIPTION_LIMIT}
            maskPhone={maskPhone}
            showToast={showToast}
            db={db}
            deleteDoc={deleteDoc}
            updateDoc={updateDoc}
            doc={doc}
          />
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
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600 z-10" />
              
              <div className="p-8 overflow-y-auto scrollbar-hide">
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
              </div>
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
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600 z-10" />
              
              <div className="p-8 overflow-y-auto scrollbar-hide">
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

                <div className="bg-pink-50/50 p-4 rounded-2xl border-2 border-pink-100/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-pink-600">Prioridade Máxima</p>
                    <p className="text-[9px] text-pink-400 font-medium leading-tight mt-0.5">
                      Ative para que este serviço sempre venha primeiro em agendamentos de combos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewService(prev => ({ ...prev, prioridade: prev.prioridade === 1 ? 0 : 1 }))}
                    className={`shrink-0 w-12 h-6 rounded-full transition-all relative ${newService.prioridade === 1 ? 'bg-pink-500' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newService.prioridade === 1 ? 'left-7' : 'left-1'}`} />
                  </button>
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
              </div>
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
        establishment={establishment}
        onReschedule={handleConfirmReschedule}
        allProfessionals={allProfessionals}
        onUpdateAppointment={handleUpdateAppointment}
        allAppointments={allAppointments}
      />

      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-rose-500 z-10" />
              
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Registrar Despesa</h3>
                  <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Descrição</label>
                    <input
                      type="text"
                      required
                      value={newExpense.description}
                      onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-rose-300 transition-all font-bold text-gray-700 text-sm"
                      placeholder="Ex: Aluguel, Produtos, Luz..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Valor (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newExpense.value}
                        onChange={e => setNewExpense({ ...newExpense, value: e.target.value })}
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-rose-300 transition-all font-bold text-gray-700 text-sm"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Data</label>
                      <input
                        type="date"
                        required
                        value={newExpense.date}
                        onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-rose-300 transition-all font-bold text-gray-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Categoria</label>
                    <select
                      value={newExpense.category}
                      onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-rose-300 transition-all font-bold text-gray-700 text-sm"
                    >
                      <option value="Produtos">Produtos / Insumos</option>
                      <option value="Infraestrutura">Aluguel / Luz / Água</option>
                      <option value="Marketing">Marketing / Tráfego</option>
                      <option value="SaaS">Software / Ferramentas</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={expenseLoading}
                      className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {expenseLoading ? 'Salvando...' : 'Salvar Despesa'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!reportLoading) setIsReportModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-600 z-10" />
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Relatório</h3>
                  <button
                    onClick={() => {
                      if (!reportLoading) setIsReportModalOpen(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="bg-indigo-50 p-5 rounded-[2rem] border border-indigo-100 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileDown size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">Relatório financeiro em PDF</p>
                    <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                      O PDF será gerado com base nos filtros atuais (período e profissional) e contém os dados exibidos na tela.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-white text-slate-600 rounded-full border border-indigo-100">
                        {format(financeFilter.startDate, 'dd/MM')} - {format(financeFilter.endDate, 'dd/MM')}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-white text-slate-600 rounded-full border border-indigo-100">
                        {financeMode === 'equipe' ? 'Equipe' : 'Salão'}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-white text-slate-600 rounded-full border border-indigo-100">
                        {(() => {
                          const activeId =
                            financeMode === 'equipe' ? teamSelectedProfessionalId : financeFilter.professionalId !== 'all' ? financeFilter.professionalId : null;
                          const prof = activeId ? allProfessionals.find(p => p.id === activeId) : null;
                          return prof?.nome ? prof.nome : 'Toda Equipe';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    disabled={reportLoading}
                    className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const element = document.getElementById('finance-report');
                      if (!element) {
                        showToast('Nada para exportar.', 'error');
                        return;
                      }
                      setReportLoading(true);
                      setIsReportModalOpen(false);
                      await new Promise(r => setTimeout(r, 50));
                      showToast('Gerando relatório...');
                      try {
                        const canvas = await html2canvas(element, { scale: 2 });
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const imgProps = pdf.getImageProperties(imgData);
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                        pdf.save(`relatorio-financeiro-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
                      } catch (err) {
                        console.error('Erro PDF:', err);
                        showToast('Erro ao gerar PDF', 'error');
                      } finally {
                        setReportLoading(false);
                      }
                    }}
                    disabled={reportLoading}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {reportLoading ? 'Gerando...' : 'Baixar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpenseToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase mb-2">Excluir Despesa?</h3>
              <p className="text-gray-500 font-medium mb-8">
                Tem certeza que deseja remover a despesa <strong>{expenseToDelete.description}</strong> no valor de <strong>R$ {Number(expenseToDelete.value).toFixed(2)}</strong>?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setExpenseToDelete(null)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteExpense}
                  disabled={expenseLoading}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {expenseLoading ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Adicionar Profissional */}
      <AnimatePresence>
        {isTeamModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSavingMember) {
                  setIsTeamModalOpen(false);
                  setEditingMemberId(null);
                  setCreatedCredentials(null);
                  setNewMember({ 
                    nome: '', 
                    cargo: '', 
                    foto: '', 
                    servicos: [], 
                    email: '', 
                    password: '',
                    break_time: { enabled: false, start: '12:00', end: '13:00' }
                  });
                  setShowTeamPassword(false);
                }
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600 z-10" />
              
              <div className="p-8 overflow-y-auto scrollbar-hide">
                {!createdCredentials ? (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                        {editingMemberId ? 'Editar Profissional' : 'Novo Profissional'}
                      </h3>
                      <button 
                        onClick={() => {
                          setIsTeamModalOpen(false);
                          setEditingMemberId(null);
                          setNewMember({ 
                            nome: '', 
                            cargo: '', 
                            foto: '', 
                            servicos: [], 
                            email: '', 
                            password: '',
                            break_time: { enabled: false, start: '12:00', end: '13:00' }
                          });
                          setShowTeamPassword(false);
                        }} 
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                      >
                        <X size={24} />
                      </button>
                    </div>

                  {/* Preview do Avatar */}
                  <div className="flex flex-col items-center justify-center mb-8">
                    <ProfessionalAvatar 
                      nome={newMember.nome || 'Novo'} 
                      foto={newMember.foto} 
                      size="w-24 h-24" 
                    />
                    <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-3">Prévia do Perfil</p>
                  </div>

                  <form onSubmit={handleSaveTeamMember} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={newMember.nome}
                        onChange={e => setNewMember({ ...newMember, nome: e.target.value })}
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                        placeholder="Ex: Maria Silva"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">E-mail Real do Profissional</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email"
                          required
                          disabled={!!editingMemberId}
                          value={newMember.email}
                          onChange={e => setNewMember({...newMember, email: e.target.value})}
                          className={`w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-pink-300 outline-none transition-all font-bold text-gray-700 text-sm ${editingMemberId ? 'opacity-60 cursor-not-allowed' : ''}`}
                          placeholder="Ex: profissional@gmail.com"
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400 italic">
                        * O profissional usará este e-mail para acessar e recuperar a senha se esquecer.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Cargo / Especialidade</label>
                      <input
                        type="text"
                        required
                        value={newMember.cargo}
                        onChange={e => setNewMember({ ...newMember, cargo: e.target.value })}
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                        placeholder="Ex: Esteticista, Manicure..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Comissão (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          value={newMember.commission_percentage}
                          onChange={e => setNewMember({...newMember, commission_percentage: e.target.value})}
                          className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-pink-300 outline-none transition-all font-bold text-gray-700 text-sm"
                          placeholder="Ex: 30"
                        />
                      </div>
                    </div>

                    {editingMemberId && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Dados de Acesso</p>
                        {newMember.email ? (
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                              <Mail size={12} className="text-pink-400" /> {newMember.email}
                            </p>
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(newMember.email);
                                showToast("E-mail copiado!");
                              }}
                              className="text-[9px] font-black text-pink-600 uppercase"
                            >
                              Copiar
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">E-mail não disponível</p>
                        )}
                        {newMember.password ? (
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                              <Lock size={12} className="text-slate-400" /> Senha: {showTeamPassword ? newMember.password : '••••••••'}
                            </p>
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setShowTeamPassword(!showTeamPassword)}
                                className="p-1 text-slate-400 hover:text-pink-600 transition-colors"
                                title={showTeamPassword ? "Esconder senha" : "Mostrar senha"}
                              >
                                {showTeamPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(newMember.password);
                                  showToast("Senha copiada!");
                                }}
                                className="text-[9px] font-black text-pink-600 uppercase"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Senha protegida</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Serviços que realiza</label>
                      <div className="bg-gray-50 p-4 rounded-2xl max-h-40 overflow-y-auto space-y-2">
                        {services.map(service => (
                          <label key={service.id} className="flex items-center gap-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              newMember.servicos.includes(service.id) ? 'bg-pink-600 border-pink-600' : 'border-gray-200 group-hover:border-pink-300'
                            }`}>
                              {newMember.servicos.includes(service.id) && <Check size={14} className="text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={newMember.servicos.includes(service.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewMember(prev => ({ ...prev, servicos: [...prev.servicos, service.id] }));
                                } else {
                                  setNewMember(prev => ({ ...prev, servicos: prev.servicos.filter(id => id !== service.id) }));
                                }
                              }}
                            />
                            <span className="text-sm font-bold text-gray-700">{service.nome}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* CONFIGURAÇÃO DE PAUSA / ALMOÇO */}
                    <div className="p-5 bg-pink-50/50 rounded-3xl border-2 border-pink-100/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
                            <Clock size={16} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-pink-600">Pausa / Almoço</p>
                            <p className="text-[9px] text-pink-400 font-bold">Bloqueio automático diário</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewMember(prev => ({
                            ...prev,
                            break_time: { 
                              ...(prev.break_time || { start: '12:00', end: '13:00' }), 
                              enabled: !prev.break_time?.enabled 
                            }
                          }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${newMember.break_time?.enabled ? 'bg-pink-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newMember.break_time?.enabled ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {newMember.break_time?.enabled && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-tighter text-slate-400 ml-1">Início</label>
                            <input
                              type="time"
                              value={newMember.break_time?.start || '12:00'}
                              onChange={e => setNewMember(prev => ({
                                ...prev,
                                break_time: { ...(prev.break_time || { enabled: true, end: '13:00' }), start: e.target.value }
                              }))}
                              className="w-full p-3 bg-white border border-pink-100 rounded-xl outline-none focus:border-pink-300 font-bold text-slate-700 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-tighter text-slate-400 ml-1">Retorno</label>
                            <input
                              type="time"
                              value={newMember.break_time?.end || '13:00'}
                              onChange={e => setNewMember(prev => ({
                                ...prev,
                                break_time: { ...(prev.break_time || { enabled: true, start: '12:00' }), end: e.target.value }
                              }))}
                              className="w-full p-3 bg-white border border-pink-100 rounded-xl outline-none focus:border-pink-300 font-bold text-slate-700 text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsTeamModalOpen(false);
                          setEditingMemberId(null);
                          setNewMember({ 
                            nome: '', 
                            cargo: '', 
                            foto: '', 
                            servicos: [], 
                            email: '', 
                            password: '',
                            break_time: { enabled: false, start: '12:00', end: '13:00' }
                          });
                          setShowTeamPassword(false);
                        }}
                        className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingMember}
                        className="flex-1 py-4 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isSavingMember ? (editingMemberId ? 'Salvando...' : 'Criando Conta...') : (editingMemberId ? 'Salvar Alterações' : 'Adicionar Profissional')}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} />
                  </div>
                  
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Acesso Criado!</h3>
                  <p className="text-sm text-gray-500 font-medium mb-8">
                    A conta de <strong>{createdCredentials.nome}</strong> foi criada. <br/>
                    <span className="text-pink-600 font-bold">Ele(a) deverá trocar a senha no primeiro acesso.</span>
                  </p>

                  <div className="space-y-3 mb-8">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">E-mail de Login</p>
                      <p className="font-bold text-gray-700">{createdCredentials.email}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Senha Temporária</p>
                      <p className="font-bold text-gray-700">{createdCredentials.password}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        const message = `Olá ${createdCredentials.nome}! Seu acesso profissional no Musa Agenda está pronto.\n\n🔗 Acesse: ${window.location.origin}/login\n📧 Login: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}\n\n⚠️ Por segurança, você deverá trocar esta senha no primeiro acesso.`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={18} /> Enviar via WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        setIsTeamModalOpen(false);
                        setEditingMemberId(null);
                        setCreatedCredentials(null);
                        setNewMember({ 
                          nome: '', 
                          cargo: '', 
                          foto: '', 
                          servicos: [], 
                          email: '', 
                          password: '',
                          break_time: { enabled: false, start: '12:00', end: '13:00' }
                        });
                        setShowTeamPassword(false);
                      }}
                      className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Modal de Agendamento Manual */}
      <AnimatePresence>
        {isManualAppModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualAppModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 to-rose-600 z-10" />
              
              <div className="p-8 overflow-y-auto scrollbar-hide">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Novo Agendamento</h3>
                  <button onClick={() => setIsManualAppModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X size={24} />
                  </button>
                </div>

              <form onSubmit={handleSaveManualAppointment} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Nome da Cliente</label>
                  <input
                    type="text"
                    required
                    value={manualAppData.user_nome}
                    onChange={e => setManualAppData({ ...manualAppData, user_nome: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Ex: Maria Silva"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">WhatsApp (Opcional)</label>
                  <input
                    type="tel"
                    value={manualAppData.user_telefone}
                    onChange={e => setManualAppData({ ...manualAppData, user_telefone: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Serviço</label>
                    <select
                      required
                      value={manualAppData.service_id}
                      onChange={e => setManualAppData({ ...manualAppData, service_id: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm appearance-none"
                    >
                      <option value="">Selecione...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nome} {s.prioridade === 1 ? '⭐' : ''} - R$ {s.preco}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Profissional</label>
                    <select
                      required
                      value={manualAppData.professional_id}
                      onChange={e => setManualAppData({ ...manualAppData, professional_id: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm appearance-none"
                    >
                      <option value="">Selecione...</option>
                      {allProfessionals.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Data e Horário</label>
                  <input
                    type="datetime-local"
                    required
                    value={manualAppData.data_hora}
                    onChange={e => setManualAppData({ ...manualAppData, data_hora: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsManualAppModalOpen(false)}
                    className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingManualApp}
                    className="flex-1 py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-100 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSavingManualApp ? 'Agendando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Cancelamento de Assinatura */}
      <AnimatePresence>
        {isCancelSubscriptionModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <AlertCircle size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Cancelar Assinatura?</h3>
                  <p className="text-gray-500 font-medium">
                    Ao cancelar, você perderá acesso aos recursos exclusivos do plano <span className="text-pink-600 font-bold">{currentPlanName}</span> ao final do seu ciclo atual.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">O que acontece agora:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-xs font-bold text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      Você continua usando os recursos até o fim do período pago.
                    </li>
                    <li className="flex items-start gap-2 text-xs font-bold text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      Nenhuma nova cobrança será feita.
                    </li>
                    <li className="flex items-start gap-2 text-xs font-bold text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      Seus dados e histórico permanecem salvos.
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loading}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Processando...' : 'Confirmar Cancelamento'}
                  </button>
                  <button
                    onClick={() => setIsCancelSubscriptionModalOpen(false)}
                    disabled={loading}
                    className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-100 transition-all"
                  >
                    Manter minha Assinatura
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Seleção de Modelo de Anamnese */}
      <AnimatePresence>
        {isSelectingTemplate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Escolha o Modelo</h3>
                  <button onClick={() => setIsSelectingTemplate(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {anamnesisTemplates.length > 0 ? (
                    anamnesisTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setActiveAnamnesisTemplate(template);
                          setIsSelectingTemplate(false);
                          setIsFillingAnamnesis(true);
                        }}
                        className="w-full p-5 bg-gray-50 border-2 border-transparent hover:border-pink-200 hover:bg-pink-50/30 rounded-[2rem] text-left transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white text-pink-600 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <ClipboardList size={24} />
                          </div>
                          <div>
                            <p className="font-black text-gray-800 uppercase tracking-tight">{template.nome}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{template.perguntas?.length || 0} Perguntas</p>
                          </div>
                          <ChevronRight size={20} className="ml-auto text-gray-300 group-hover:text-pink-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-10 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-100 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle size={32} />
                      </div>
                      <p className="text-sm font-bold text-gray-400">Nenhum modelo de ficha encontrado. Crie um modelo na aba de Configurações primeiro.</p>
                      <button
                        onClick={() => {
                          setIsSelectingTemplate(false);
                          setView('config');
                          setOpenConfigSection('anamnese');
                        }}
                        className="text-xs font-black text-pink-600 uppercase tracking-widest hover:underline"
                      >
                        Ir para Configurações
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Preenchimento de Ficha de Anamnese */}
      <AnimatePresence>
        {isFillingAnamnesis && activeAnamnesisTemplate && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <AnamnesisForm
                template={activeAnamnesisTemplate}
                establishmentId={establishment.id}
                customerId={anamnesisCustomerId}
                onComplete={() => {
                  setIsFillingAnamnesis(false);
                  setActiveAnamnesisTemplate(null);
                  showToast("Ficha de anamnese salva com sucesso!");
                  // Força atualização da lista de anamneses da cliente se estiver aberta
                  if (expandedClientId === anamnesisCustomerId) {
                    // Simula clique na aba para recarregar
                    const btn = document.querySelector(`button[data-anamnesis-refresh="${anamnesisCustomerId}"]`);
                    if (btn) btn.click();
                  }
                }}
                onCancel={() => {
                  setIsFillingAnamnesis(false);
                  setActiveAnamnesisTemplate(null);
                }}
              />
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

      {/* B-11: Banner UNDO cancelamento fixo embaixo (janela 2 min) */}
      <AnimatePresence>
        {pendingCancelUndo && (() => {
          const remainingMs = Math.max(0, pendingCancelUndo.expiresAt - Date.now());
          const remainingSec = Math.ceil(remainingMs / 1000);
          const min = Math.floor(remainingSec / 60);
          const sec = remainingSec % 60;
          const pad = (n) => String(n).padStart(2, '0');
          const progress = remainingMs / 120000;
          return (
            <motion.div
              initial={{ opacity: 0, y: 60, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 60, x: '-50%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="fixed bottom-4 left-1/2 z-[110] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-[1.75rem] bg-slate-900 shadow-2xl shadow-slate-900/40 ring-1 ring-white/10 backdrop-blur overflow-hidden"
            >
              {/* barra de progresso expiração */}
              <div className="h-1 w-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-200 transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
                />
              </div>
              <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 text-white">
                <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                  <Undo2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-black leading-tight">
                    Agendamento cancelado
                  </p>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-300 leading-relaxed">
                    Janela para desfazer:&nbsp;
                    <span className="tabular-nums text-emerald-300 font-black">
                      {min}:{pad(sec)}
                    </span>
                    <span className="hidden sm:inline">  —  caso desfaça, voltará ao status original automaticamente.</span>
                  </p>
                </div>
                <button
                  onClick={handleUndoCancelAppointment}
                  disabled={loading}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black uppercase tracking-wider px-3.5 sm:px-5 py-2.5 sm:py-3 active:scale-95 transition-all shadow-lg shadow-emerald-900/30"
                >
                  <Undo2 size={15} />
                  <span className="hidden sm:inline">Desfazer Cancelamento</span>
                  <span className="sm:hidden">Desfazer</span>
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      </div>
    </SubscriptionGuard>
  );
}
