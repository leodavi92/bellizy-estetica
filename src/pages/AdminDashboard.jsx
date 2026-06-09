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
  Save
} from 'lucide-react';
import { isSlugAvailable, sanitizeSlug } from '../services/establishmentService';
import { createAppointment, APPOINTMENT_STATUS, normalizeStatus, getAvailableSlots, getMultiProfessionalAvailableSlots } from '../services/appointmentService';
import { recordAppointmentTransaction, getTransactions, markCommissionAsPaid } from '../services/financeService';
import { 
  createManagedStaffAccount, 
  deleteManagedStaffAccount, 
  generateTemporaryPassword 
} from '../services/teamService';
import OnboardingWizard from '../components/admin/onboarding/OnboardingWizard';
import WeeklyAvailabilityEditor from '../components/admin/settings/WeeklyAvailabilityEditor';
import CancellationPolicySettings from '../components/admin/settings/CancellationPolicySettings';
import AvailabilityCalendar from '../components/admin/settings/AvailabilityCalendar';
import AnamnesisManager from '../components/admin/settings/AnamnesisManager';
import ReminderManager from '../components/admin/dashboard/ReminderManager';
import AnamnesisForm from '../components/client/AnamnesisForm';
import NextAppointmentSection from '../components/admin/dashboard/NextAppointmentSection';
import AppointmentCalendar from '../components/admin/dashboard/AppointmentCalendar';
import SidebarContent from '../components/admin/dashboard/SidebarContent';
import AppointmentDetailsModal from '../components/admin/dashboard/AppointmentDetailsModal';
import SubscriptionGuard from '../components/admin/dashboard/SubscriptionGuard';
import { subscriptionService } from '../services/subscriptionService';
import { createInternalNotification, createClientNotification } from '../services/notificationService';
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

// Componente de Avatar para Profissionais
const ProfessionalAvatar = ({ foto, nome, size = "w-16 h-16", isUploading = false }) => {
  if (isUploading) {
    return (
      <div className={`${size} rounded-2xl bg-pink-50 flex items-center justify-center text-pink-600 shadow-sm border-2 border-white overflow-hidden`}>
        <div className="animate-spin"><Sparkles size={24} /></div>
      </div>
    );
  }

  if (foto) {
    return (
      <div className={`${size} rounded-2xl shadow-sm border-2 border-white overflow-hidden shrink-0`}>
        <img src={foto} alt={nome} className="w-full h-full object-cover" />
      </div>
    );
  }
  
  // Cores elegantes baseadas no nome
  const colors = [
    'bg-pink-100 text-pink-600',
    'bg-purple-100 text-purple-600',
    'bg-blue-100 text-blue-600',
    'bg-indigo-100 text-indigo-600',
    'bg-emerald-100 text-emerald-600',
    'bg-rose-100 text-rose-600',
    'bg-amber-100 text-amber-600'
  ];
  
  const charCode = (nome || 'M').charCodeAt(0);
  const colorIndex = charCode % colors.length;
  const initials = (nome || 'M').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className={`${size} rounded-2xl ${colors[colorIndex]} flex items-center justify-center font-black text-xl shadow-sm border-2 border-white shrink-0 tracking-tighter`}>
      {initials}
    </div>
  );
};

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
  
  const hasAccess = (feature) => {
    if (!establishment?.subscription) return false;
    const status = establishment.subscription.status;
    const plan = userPlan;
    
    // Se não estiver ativo, só libera visualização de assinaturas
    if (status !== 'active' && feature !== 'assinatura') return false;

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

      await updateDoc(appRef, { status: 'cancelled' });

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
          `Seu agendamento de ${servicesLabel} foi cancelado pela estética.`
        );
      }

      // Notificação para o Administrador (Interna)
      await addDoc(collection(db, "notifications"), {
        establishment_id: establishment.id,
        professional_id: appData.professional_id || 'owner',
        type: 'appointment_cancelled',
        title: 'Agendamento Cancelado ❌',
        message: `${appData.user_nome} - O agendamento de ${appData.service_nome || 'Serviço'} foi cancelado.`,
        read: false,
        appointment_id: appData.id,
        createdAt: Timestamp.now()
      });

      setIsAppDetailsModalOpen(false);
      showToast("Agendamento cancelado com sucesso!");
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      showToast("Erro ao cancelar agendamento.", "error");
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
          await addDoc(collection(db, "notifications"), {
            establishment_id: establishment.id,
            professional_id: oldAppData.professional_id || 'owner',
            type: 'appointment_cancelled',
            title: 'Agendamento Remarcado 📅',
            message: `${oldAppData.user_nome} - O horário antigo de ${oldAppData.service_nome || 'Serviço'} foi cancelado pois foi remarcado.`,
            read: false,
            appointment_id: oldAppData.id,
            createdAt: Timestamp.now()
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

      // Se for um membro da equipe (staff), atualiza a senha no documento da coleção 'professionals'
      // para que a Dona possa visualizar a nova senha no painel de edição.
      if (user?.tipo === 'staff' && user?.professional_id) {
        await updateDoc(doc(db, "professionals", user.professional_id), {
          password: passwordData.newPassword
        });
      }

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
      password: member.password || '',
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
                onClick={() => setView('planos_assinatura')}
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

            <NextAppointmentSection 
              appointments={allAppointments} 
              establishment={establishment}
              allProfessionals={allProfessionals}
              onUpdateAppointment={handleUpdateAppointment}
              onReschedule={handleConfirmReschedule}
              allAppointments={allAppointments}
            />
          </div>
        )}

        {/* VIEW: FINANCAS OU COMISSOES (STAFF) */}
        {(view === 'financas' || view === 'comissoes') && (
          view === 'financas' && !hasAccess('financas') ? (
            <UpgradeRequired feature="Gestão Financeira" />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20" id="finance-report">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
                    {view === 'comissoes' ? 'Comissões' : 'Finanças'}
                  </h2>
                  {view === 'financas' && (
                    <p className="text-gray-500 font-medium">
                      Controle seu faturamento e comissões.
                    </p>
                  )}
                  {view === 'financas' && (
                    <div className="mt-4 inline-flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-sm">
                      <button
                        onClick={() => setFinanceMode('salao')}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          financeMode === 'salao'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Salão
                      </button>
                      <button
                        onClick={() => {
                          if (userPlan === 'bronze') {
                            setFinanceMode('equipe_restricted');
                          } else {
                            setFinanceMode('equipe');
                          }
                        }}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          financeMode === 'equipe' || financeMode === 'equipe_restricted'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Equipe
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {view === 'financas' && (
                    <>
                      <button 
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100"
                        title="Registrar Despesa"
                      >
                        <Plus size={18} />
                      </button>

                      <button 
                        onClick={() => {
                          if (userPlan !== 'gold') {
                            setFinanceMode('relatorios_restricted');
                          } else {
                            setView('relatorios');
                          }
                        }}
                        className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                        title="Relatórios Detalhados"
                      >
                        <TrendingUp size={18} />
                      </button>
                    </>
                  )}

                  {view === 'financas' && (
                    <button 
                      onClick={loadFinanceData}
                      className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-pink-600 transition-all shadow-sm"
                      title="Atualizar dados"
                    >
                      <RefreshCw size={18} className={financeLoading ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>
              </div>

              {financeMode === 'equipe_restricted' ? (
                <UpgradeRequired feature="Gestão de Comissões e Equipe" />
              ) : financeMode === 'relatorios_restricted' ? (
                <UpgradeRequired feature="Relatórios Avançados" />
              ) : (financeMode === 'equipe' || view === 'comissoes') ? (
                <div className="space-y-6">
                  {(teamSelectedProfessionalId || view === 'comissoes') ? (
                    (() => {
                      const targetProfId = view === 'comissoes' ? (user?.professional_id || 'owner') : teamSelectedProfessionalId;
                      const prof = allProfessionals.find(p => p.id === targetProfId);
                      const profTx = financeTransactions
                        .filter(t => t.professional_id === targetProfId)
                        .filter(t => Number(t.total_value || 0) > 0 || Number(t.commission_value || 0) > 0)
                        .sort((a, b) => {
                          const rawA = a.createdAt || a.date;
                          const rawB = b.createdAt || b.date;
                          const aMs = rawA?.toDate ? rawA.toDate().getTime() : new Date(rawA).getTime();
                          const bMs = rawB?.toDate ? rawB.toDate().getTime() : new Date(rawB).getTime();
                          return bMs - aMs;
                        });

                      const revenue = profTx.reduce((sum, t) => sum + Number(t.total_value || 0), 0);
                      const received = profTx.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.commission_value || 0), 0);
                      const pending = profTx.filter(t => t.status !== 'paid').reduce((sum, t) => sum + Number(t.commission_value || 0), 0);

                      const totalCommission = received + pending;
                      const paidRatio = totalCommission > 0 ? received / totalCommission : 0;
                      const r = 42;
                      const c = 2 * Math.PI * r;

                      const dailyRevenue = {};
                      profTx.forEach(t => {
                        const raw = t.createdAt || t.date;
                        const d = raw?.toDate ? raw.toDate() : new Date(raw);
                        const key = format(d, 'yyyy-MM-dd');
                        dailyRevenue[key] = (dailyRevenue[key] || 0) + Number(t.total_value || 0);
                      });

                      const seriesStart = startOfDay(financeFilter.startDate);
                      const seriesEnd = endOfDay(financeFilter.endDate);
                      const seriesKeys = [];
                      for (let cursor = seriesStart; cursor <= seriesEnd; cursor = addDays(cursor, 1)) {
                        seriesKeys.push(format(cursor, 'yyyy-MM-dd'));
                      }

                      const seriesValues = seriesKeys.map(k => Number(dailyRevenue[k] || 0));
                      const max = Math.max(...seriesValues, 1);

                      const seriesPoints = seriesKeys.map((k, idx) => {
                        const x = seriesKeys.length === 1 ? 50 : (idx / (seriesKeys.length - 1)) * 100;
                        const y = 38 - (Number(dailyRevenue[k] || 0) / max) * 30;
                        return `${x},${y}`;
                      });
                      const points = seriesPoints.join(' ');
                      const areaD = seriesPoints.length > 0
                        ? `M ${seriesPoints[0]} L ${seriesPoints.slice(1).join(' L ')} L 100,40 L 0,40 Z`
                        : '';

                      const paymentLabel = (method) => {
                        const m = String(method || 'pix').toLowerCase();
                        if (m === 'pix') return 'PIX';
                        if (m === 'dinheiro' || m === 'cash') return 'DINHEIRO';
                        if (m === 'credito' || m === 'crédito' || m === 'credit') return 'CRÉDITO';
                        if (m === 'debito' || m === 'débito' || m === 'debit') return 'DÉBITO';
                        return m.toUpperCase();
                      };

                      return (
                        <div className="space-y-6">
                          <div className="bg-white rounded-[2.75rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                            {/* Cabeçalho Rosa com Texto e Botões */}
                            <div className="h-32 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 relative px-6 sm:px-8 flex items-center justify-between pb-10">
                              {view === 'financas' ? (
                                <button
                                  onClick={() => setTeamSelectedProfessionalId(null)}
                                  className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                                  title="Voltar"
                                >
                                  <ChevronLeft size={18} />
                                </button>
                              ) : (
                                  <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-white drop-shadow-md max-w-[200px] sm:max-w-none leading-tight">
                                    Acompanhe seus ganhos e atendimentos.
                                  </p>
                                )}

                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={loadFinanceData}
                                  className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                                  title="Atualizar dados"
                                >
                                  <RefreshCw size={18} className={financeLoading ? 'animate-spin' : ''} />
                                </button>
                                <button
                                  onClick={() => {
                                    const services = profTx.map(t => `• ${t.service_nome}: R$ ${Number(t.commission_value).toFixed(2)} (${t.status === 'paid' ? 'Pago' : 'Pendente'})`).join('%0A');
                                    const message = encodeURIComponent(`*EXTRATO DE COMISSÕES*%0A*${establishment?.nome}*%0A%0A*Profissional:* ${prof?.nome}%0A*Período:* ${format(financeFilter.startDate, 'dd/MM')} a ${format(financeFilter.endDate, 'dd/MM')}%0A%0A*LANÇAMENTOS:*%0A${services}%0A%0A*RECEBIDO:* R$ ${received.toFixed(2)}%0A*PENDENTE:* R$ ${pending.toFixed(2)}%0A%0A✨ _Confira seus lançamentos!_`);
                                    window.open(`https://wa.me/?text=${message}`, '_blank');
                                  }}
                                  className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white hover:bg-white/30 shadow-sm transition-all"
                                  title="Compartilhar extrato"
                                >
                                  <Share2 size={18} />
                                </button>
                              </div>
                            </div>

                            <div className="px-6 sm:px-8 pb-8 -mt-12 relative z-10">
                              <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 rounded-[2rem] overflow-hidden bg-white shadow-xl ring-4 ring-white">
                                  {prof?.foto ? (
                                    <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-pink-50 text-pink-600 font-black text-3xl">
                                      {prof?.nome?.charAt(0) || 'P'}
                                    </div>
                                  )}
                                </div>
                                <h3 className="mt-4 text-2xl font-black text-slate-900 uppercase tracking-tight">
                                  {prof?.nome || 'Profissional'}
                                </h3>
                                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                  <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full border border-slate-100">
                                    {prof?.cargo || 'Profissional'}
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-pink-50 text-pink-600 rounded-full border border-pink-100">
                                    {format(financeFilter.startDate, 'dd/MM')} - {format(financeFilter.endDate, 'dd/MM')}
                                  </span>
                                </div>

                                {/* Filtros de Período reposicionados */}
                                <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4 overflow-x-auto no-scrollbar">
                                  {[
                                    { id: 'today', label: 'Hoje', icon: <Clock size={12} /> },
                                    { id: 'week', label: 'Últimos 7 dias', icon: <Calendar size={12} /> },
                                    { id: 'month', label: 'Mês Atual', icon: <CalendarCheck size={12} /> },
                                    { id: 'year', label: 'Este Ano', icon: <TrendingUp size={12} /> }
                                  ].map(p => {
                                    const isActive = isSameDay(financeFilter.startDate, p.id === 'today' ? startOfDay(new Date()) : p.id === 'month' ? startOfMonth(new Date()) : p.id === 'year' ? startOfYear(new Date()) : subDays(new Date(), 7));
                                    return (
                                      <button
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${
                                          isActive 
                                            ? 'bg-slate-900 text-white shadow-md' 
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                        }`}
                                      >
                                        {p.icon}
                                        {p.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                                <div className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bruto Faturado</p>
                                  <p className="text-2xl font-black text-slate-900 mt-2">R$ {revenue.toFixed(2)}</p>
                                </div>
                                <div className="p-5 rounded-[2rem] bg-emerald-50 border border-emerald-100">
                                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Já Recebeu</p>
                                  <p className="text-2xl font-black text-emerald-700 mt-2">R$ {received.toFixed(2)}</p>
                                </div>
                                <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100">
                                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pendente</p>
                                  <p className="text-2xl font-black text-amber-700 mt-2">R$ {pending.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                              <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Pagamentos (Comissão)</p>
                              <div className="flex items-center gap-6">
                                <div className="relative w-[120px] h-[120px]">
                                  <svg viewBox="0 0 100 100" className="w-full h-full">
                                    <circle cx="50" cy="50" r={r} stroke="#f1f5f9" strokeWidth="12" fill="none" />
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r={r}
                                      stroke="#10b981"
                                      strokeWidth="12"
                                      fill="none"
                                      strokeDasharray={`${paidRatio * c} ${c}`}
                                      strokeLinecap="round"
                                      transform="rotate(-90 50 50)"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pago</p>
                                    <p className="text-lg font-black text-slate-900">{Math.round(paidRatio * 100)}%</p>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                                    <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recebido</p>
                                      <p className="text-sm font-black text-slate-900">R$ {received.toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 bg-amber-400 rounded-full" />
                                    <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendente</p>
                                      <p className="text-sm font-black text-slate-900">R$ {pending.toFixed(2)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                              <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Faturamento (Linha)</p>
                              {seriesKeys.length === 0 ? (
                                <div className="h-40 flex items-center justify-center">
                                  <p className="text-sm font-bold text-slate-400 italic">Sem dados no período.</p>
                                </div>
                              ) : (
                                <div className="h-40">
                                  <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
                                    <defs>
                                      <linearGradient id={`revFill-${targetProfId || 'all'}`} x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor="#ec4899" stopOpacity="0.28" />
                                        <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                    {[10, 20, 30].map(y => (
                                      <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.5" opacity="0.7" />
                                    ))}
                                    {areaD ? <path d={areaD} fill={`url(#revFill-${targetProfId || 'all'})`} /> : null}
                                    <polyline points={points} fill="none" stroke="#ec4899" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                                    {(() => {
                                      const step = seriesKeys.length > 45 ? Math.ceil(seriesKeys.length / 20) : 1;
                                      return seriesKeys.map((k, idx) => {
                                        if (idx % step !== 0 && idx !== seriesKeys.length - 1) return null;
                                        const x = seriesKeys.length === 1 ? 50 : (idx / (seriesKeys.length - 1)) * 100;
                                        const y = 38 - (Number(dailyRevenue[k] || 0) / max) * 30;
                                        return (
                                          <circle
                                            key={k}
                                            cx={x}
                                            cy={y}
                                            r="1.7"
                                            fill="#ec4899"
                                            stroke="#ffffff"
                                            strokeWidth="0.8"
                                          />
                                        );
                                      });
                                    })()}
                                  </svg>
                                  <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span>{format(new Date(seriesKeys[0]), 'dd/MM')}</span>
                                    <span>{format(new Date(seriesKeys[seriesKeys.length - 1]), 'dd/MM')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Histórico do Profissional</h4>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{profTx.length} registros no período</span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pagamento</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Comissão</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    {view === 'financas' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {financeLoading ? (
                                    <tr>
                                      <td colSpan={view === 'comissoes' ? 7 : 8} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                          <div className="w-8 h-8 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                                          <p className="text-xs font-bold text-slate-400 uppercase">Carregando dados...</p>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : profTx.length === 0 ? (
                                    <tr>
                                      <td colSpan={view === 'comissoes' ? 7 : 8} className="px-6 py-20 text-center">
                                        <p className="text-sm font-bold text-slate-400 italic">Nenhum atendimento finalizado neste período.</p>
                                      </td>
                                    </tr>
                                  ) : (
                                    profTx.map((transaction) => (
                                      <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                          {(() => {
                                            const raw = transaction.createdAt || transaction.date;
                                            const dt = raw?.toDate ? raw.toDate() : new Date(raw);
                                            return (
                                              <>
                                                <p className="text-xs font-bold text-slate-700">{format(dt, "dd/MM")}</p>
                                                <p className="text-[9px] text-slate-400 font-medium">{format(dt, "HH:mm")}</p>
                                              </>
                                            );
                                          })()}
                                        </td>
                                        <td className="px-6 py-4">
                                          <p className="text-xs font-bold text-slate-900">{transaction.user_nome}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                          <p className="text-xs font-medium text-slate-600">{transaction.service_nome}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">
                                            {paymentLabel(transaction.payment_method)}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          <p className="text-xs font-black text-slate-900">R$ {transaction.total_value?.toFixed(2)}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          <p className="text-xs font-black text-pink-600">R$ {transaction.commission_value?.toFixed(2)}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                            transaction.status === 'paid' 
                                              ? 'bg-emerald-100 text-emerald-600' 
                                              : 'bg-amber-100 text-amber-600'
                                          }`}>
                                            {transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                          </span>
                                        </td>
                                        {view === 'financas' && (
                                          <td className="px-6 py-4 text-right">
                                            {transaction.status !== 'paid' && (
                                              <button
                                                onClick={() => handleMarkAsPaid(transaction.id)}
                                                className="p-2 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                                title="Marcar como Pago"
                                              >
                                                <Check size={14} />
                                              </button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allProfessionals.map((prof) => (
                        <button
                          key={prof.id}
                          onClick={() => setTeamSelectedProfessionalId(prof.id)}
                          className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4"
                        >
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 shrink-0">
                            {prof.foto ? (
                              <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-pink-50 text-pink-600 font-black text-xl">
                                {prof.nome?.charAt(0) || 'P'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{prof.cargo || 'Profissional'}</p>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{prof.nome}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ver detalhes</p>
                          </div>
                          <ChevronRight size={18} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Cards de Resumo Financeiro */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {(() => {
                      const filtered = financeTransactions.filter(t => 
                        financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId
                      );
                      const totalRevenue = filtered.reduce((sum, t) => sum + Number(t.total_value || 0), 0);
                      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.value || 0), 0);
                      const pendingCommissions = filtered
                        .filter(t => t.status !== 'paid')
                        .reduce((sum, t) => sum + Number(t.commission_value || 0), 0);
                      const netProfit = totalRevenue - filtered.reduce((sum, t) => sum + Number(t.commission_value || 0), 0) - totalExpenses;

                      return (
                        <>
                          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                              <DollarSign size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faturamento Bruto</p>
                              <h3 className="text-2xl font-black text-gray-800">R$ {totalRevenue.toFixed(2)}</h3>
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                              <LogOut size={24} className="rotate-180" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Despesas</p>
                              <h3 className="text-2xl font-black text-gray-800">R$ {totalExpenses.toFixed(2)}</h3>
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                              <Percent size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comissões Pendentes</p>
                              <h3 className="text-2xl font-black text-gray-800">R$ {pendingCommissions.toFixed(2)}</h3>
                            </div>
                          </div>

                          <div className="bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-800 shadow-xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center">
                              <TrendingUp size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lucro Real</p>
                              <h3 className="text-2xl font-black text-white">R$ {netProfit.toFixed(2)}</h3>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

              {/* Botões de Período Arredondados abaixo do Saldo */}
              <div className="flex flex-wrap items-center gap-2 bg-gray-50/50 p-2 rounded-[2rem] border border-gray-100 w-fit">
                {[
                  { id: 'today', label: 'Hoje', icon: <Clock size={12} /> },
                  { id: 'week', label: 'Últimos 7 dias', icon: <Calendar size={12} /> },
                  { id: 'month', label: 'Mês Atual', icon: <CalendarCheck size={12} /> },
                  { id: 'year', label: 'Este Ano', icon: <TrendingUp size={12} /> }
                ].map(p => {
                  const isActive = isSameDay(financeFilter.startDate, p.id === 'today' ? startOfDay(new Date()) : p.id === 'month' ? startOfMonth(new Date()) : p.id === 'year' ? startOfYear(new Date()) : subDays(new Date(), 7));
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        isActive 
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                        : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100 shadow-sm'
                      }`}
                    >
                      {p.icon}
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Gráfico Simples de Faturamento por Dia */}
              {financeTransactions.length > 0 && (
                <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center mb-10">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Faturamento por Dia</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full">Desempenho Diário</span>
                  </div>
                  
                  <div className="h-64 flex items-end gap-3 sm:gap-6 px-2 overflow-x-auto pb-4 custom-scrollbar">
                    {(() => {
                      const dailyData = {};
                      const filteredTransactions = financeTransactions.filter(t => 
                        financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId
                      );

                      filteredTransactions.forEach(t => {
                        const dateStr = format(t.date?.toDate ? t.date.toDate() : new Date(t.date), 'dd/MM');
                        dailyData[dateStr] = (dailyData[dateStr] || 0) + Number(t.total_value || 0);
                      });
                      
                      const labels = Object.keys(dailyData).sort((a, b) => {
                        const [dayA, monthA] = a.split('/').map(Number);
                        const [dayB, monthB] = b.split('/').map(Number);
                        return monthA !== monthB ? monthA - monthB : dayA - dayB;
                      });
                      
                      const max = Math.max(...Object.values(dailyData), 1);
                      
                      return labels.map(label => {
                        const value = dailyData[label];
                        const heightPercent = Math.max((value / max) * 100, 8); // Mínimo 8% para visibilidade
                        
                        return (
                          <div key={label} className="flex flex-col items-center gap-4 group relative min-w-[40px] sm:min-w-[60px] h-full justify-end">
                            {/* Valor fixo sobre a barra (sempre visível ou no hover) */}
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20 shadow-xl pointer-events-none border border-slate-700">
                              R$ {value.toFixed(2)}
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                            </div>

                            {/* A barra com cor sólida e largura garantida */}
                            <div 
                              className="w-10 sm:w-14 bg-pink-500 rounded-2xl transition-all relative shadow-lg shadow-pink-200 group-hover:bg-pink-600 group-hover:shadow-pink-300"
                              style={{ height: `${heightPercent}%` }}
                            >
                              {/* Brilho interno na barra */}
                              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl" />
                            </div>

                            {/* Label da data */}
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">
                                {label}
                              </span>
                              <div className="w-1 h-1 bg-pink-500 rounded-full mt-1 opacity-40" />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* Linha de Base Decorativa */}
                  <div className="h-1 w-full bg-slate-50 rounded-full mt-2" />
                </div>
              )}

              {/* Lista de Transações Detalhada */}
              <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Histórico de Atendimentos</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-50 text-pink-600 rounded-full">
                      <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Hoje: {format(new Date(), 'dd/MM')}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profissional</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pagamento</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Comissão</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {financeLoading ? (
                        <tr>
                          <td colSpan="9" className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-8 h-8 border-4 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                              <p className="text-xs font-bold text-slate-400 uppercase">Carregando dados...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (() => {
                        const todayTransactions = financeTransactions
                          .filter(t => {
                            const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                            const isToday = isSameDay(tDate, new Date());
                            const matchesProf = financeFilter.professionalId === 'all' || t.professional_id === financeFilter.professionalId;
                            return isToday && matchesProf;
                          });

                        return todayTransactions.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="px-6 py-20 text-center">
                              <p className="text-sm font-bold text-slate-400 italic">Nenhum atendimento finalizado hoje.</p>
                            </td>
                          </tr>
                        ) : (
                          todayTransactions.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-xs font-bold text-slate-700">
                                  {transaction.date?.toDate ? format(transaction.date.toDate(), "dd/MM") : '--/--'}
                                </p>
                                <p className="text-[9px] text-slate-400 font-medium">
                                  {transaction.date?.toDate ? format(transaction.date.toDate(), "HH:mm") : '--:--'}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs font-bold text-slate-900">{transaction.user_nome}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs font-bold text-slate-700">{transaction.professional_nome}</p>
                                <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter">
                                  {transaction.commission_percentage}%
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-xs font-medium text-slate-600">{transaction.service_nome}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">
                                  {transaction.payment_method || 'PIX'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <p className="text-xs font-black text-slate-900">R$ {transaction.total_value?.toFixed(2)}</p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <p className="text-xs font-black text-pink-600">R$ {transaction.commission_value?.toFixed(2)}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                  transaction.status === 'paid' 
                                    ? 'bg-emerald-100 text-emerald-600' 
                                    : 'bg-amber-100 text-amber-600'
                                }`}>
                                  {transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {transaction.status !== 'paid' && (
                                  <button
                                    onClick={() => handleMarkAsPaid(transaction.id)}
                                    className="p-2 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                    title="Marcar como Pago"
                                  >
                                    <Check size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lista de Despesas */}
              {expenses.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-sm overflow-hidden mt-6">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-rose-50/20">
                    <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">Controle de Despesas</h4>
                    <span className="text-[10px] font-bold text-rose-400 uppercase">{expenses.length} registros no período</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {expenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-rose-50/10 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-700">
                                {expense.date?.toDate ? format(expense.date.toDate(), "dd/MM") : '--/--'}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-900">{expense.description}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-rose-50 text-rose-600 rounded-lg">
                                {expense.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className="text-xs font-black text-rose-600">R$ {Number(expense.value).toFixed(2)}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setExpenseToDelete(expense)}
                                className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )
        )}

        {/* VIEW: RELATORIOS (PLANO GOLD) */}
        {view === 'relatorios' && (
          !hasAccess('relatorios_avancados') ? (
            <UpgradeRequired feature="Relatórios Avançados" />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('financas')}
                    className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-pink-600 transition-all shadow-sm"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Relatórios</h2>
                    <p className="text-gray-500 font-medium">Análise detalhada de performance e faturamento.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-pink-100 shadow-sm">
                  <button 
                    onClick={() => setIsReportModalOpen(true)}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                    title="Exportar PDF Financeiro"
                  >
                    <FileDown size={16} />
                  </button>
                  <button 
                    onClick={() => setPeriod('month')}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-pink-600 text-white shadow-md shadow-pink-100"
                  >
                    Este Mês
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Card: Ticket Médio */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
                  <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-6">
                    <TrendingUp size={24} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Médio</p>
                  <h3 className="text-3xl font-black text-gray-900">
                    R$ {financeTransactions.length > 0 
                      ? (financeTransactions.reduce((sum, t) => sum + Number(t.total_value || 0), 0) / financeTransactions.length).toFixed(2)
                      : '0.00'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-2">Valor médio por atendimento</p>
                </div>

                {/* Card: Taxa de Ocupação (Simulada ou baseada em slots) */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                    <CalendarCheck size={24} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de Atendimentos</p>
                  <h3 className="text-3xl font-black text-gray-900">{allAppointments.length}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-2">Histórico total acumulado</p>
                </div>

                {/* Card: Clientes Recorrentes */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                    <Users size={24} />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Clientes na Base</p>
                  <h3 className="text-3xl font-black text-gray-900">{clientsList.length}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-2">Clientes únicos cadastrados</p>
                </div>
              </div>

              {/* Serviços Mais Procurados */}
              <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-pink-50 flex justify-between items-center bg-pink-50/20">
                  <h4 className="text-sm font-black text-pink-900 uppercase tracking-widest">Ranking de Serviços</h4>
                  <span className="text-[10px] font-bold text-pink-400 uppercase">Top Performers</span>
                </div>
                <div className="p-8">
                  <div className="space-y-6">
                    {(() => {
                      const serviceStats = {};
                      financeTransactions.forEach(t => {
                        const name = t.service_nome || 'Outros';
                        if (!serviceStats[name]) serviceStats[name] = { count: 0, revenue: 0 };
                        serviceStats[name].count += 1;
                        serviceStats[name].revenue += Number(t.total_value || 0);
                      });
                      
                      const sorted = Object.entries(serviceStats)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .slice(0, 5);

                      if (sorted.length === 0) return <p className="text-center text-gray-400 font-medium py-10">Nenhum dado financeiro para exibir o ranking.</p>;

                      const maxRevenue = sorted[0][1].revenue || 1;

                      return sorted.map(([name, stats], idx) => (
                        <div key={name} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-black text-pink-200">0{idx + 1}</span>
                              <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gray-900">R$ {stats.revenue.toFixed(2)}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{stats.count} atendimentos</p>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(stats.revenue / maxRevenue) * 100}%` }}
                              transition={{ duration: 1, delay: idx * 0.1 }}
                              className="h-full bg-pink-500 rounded-full"
                            />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
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
                            const isRestricted = (layout.plan === 'silver' && userPlan === 'bronze') || 
                                               (layout.plan === 'gold' && (userPlan === 'bronze' || userPlan === 'silver'));
                            
                            return (
                              <button
                                key={layout.id}
                                onClick={() => {
                                  if (isRestricted) {
                                    showToast(`O layout ${layout.name} requer o plano ${layout.plan === 'gold' ? 'Premium VIP' : 'Profissional'}!`, "error");
                                    setView('assinatura');
                                    return;
                                  }
                                  setMinisiteSettings({ ...minisiteSettings, layoutId: layout.id });
                                }}
                                className={`flex items-start justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                                  minisiteSettings.layoutId === layout.id
                                    ? 'border-pink-600 bg-pink-50/30'
                                    : 'border-gray-100 hover:border-pink-200 bg-white'
                                } ${isRestricted ? 'opacity-75 bg-gray-50/50' : ''}`}
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
                                      {isRestricted && <Lock size={12} className="text-pink-500" />}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                                  </div>
                                </div>
                                {isRestricted && (
                                  <span className="text-[9px] font-black uppercase tracking-widest bg-pink-50 text-pink-600 px-2 py-1 rounded-md border border-pink-100">Bloqueado</span>
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
        {view === 'assinatura' && hasActiveSubscription && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 border border-pink-100 shadow-sm space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-600">Detalhes da Assinatura</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3 className="text-3xl font-black text-gray-900 tracking-tight">Plano atual: {currentPlanName}</h3>
                    <span className={`w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      establishment?.subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                      establishment?.subscription?.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {establishment?.subscription?.status === 'active' ? 'Ativo' : 
                       establishment?.subscription?.status === 'cancelled' ? 'Cancelado' : 'Em Teste'}
                    </span>
                  </div>
                  <p className="text-gray-500 font-medium max-w-2xl">
                    {establishment?.subscription?.status === 'cancelled' 
                      ? 'Sua assinatura foi cancelada. Você ainda pode usar todos os recursos até o final do período pago.'
                      : 'Aqui voce acompanha status, uso do plano, limite mensal e as opcoes de upgrade em um lugar so.'}
                  </p>
                  <p className={`text-sm font-bold ${establishment?.subscription?.status === 'cancelled' ? 'text-red-600' : 'text-gray-500'}`}>
                    {establishment?.subscription?.status === 'active'
                      ? `Sua assinatura renova em ${format(safeToDate(establishment.subscription.current_period_end), "dd 'de' MMMM", { locale: ptBR })}`
                      : establishment?.subscription?.status === 'cancelled'
                      ? `Seu acesso será encerrado em ${format(safeToDate(establishment.subscription.current_period_end), "dd 'de' MMMM", { locale: ptBR })}. Após essa data, sua conta voltará para o plano básico.`
                      : `Seu período de teste termina em ${format(safeToDate(establishment.subscription.trial_ends_at), "dd 'de' MMMM", { locale: ptBR })}`}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <button
                    onClick={() => setView('planos_assinatura')}
                    className="px-6 py-3 bg-pink-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-pink-700 transition-all active:scale-95 shadow-lg shadow-pink-100"
                  >
                    Ver Planos
                  </button>

                  {establishment?.subscription?.status === 'active' && (
                    <button
                      onClick={() => setIsCancelSubscriptionModalOpen(true)}
                      className="px-6 py-3 rounded-2xl text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all border border-gray-200"
                    >
                      Cancelar Assinatura
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-[2rem] border border-pink-100 bg-pink-50/50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-pink-600">Plano Atual</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white text-pink-600 flex items-center justify-center shadow-sm">
                      <currentPlan.icon size={22} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{currentPlanName}</p>
                      <p className="text-xs font-bold text-gray-500">Plano contratado no momento</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Status</p>
                  <p className={`mt-4 text-2xl font-black ${establishment?.subscription?.status === 'cancelled' ? 'text-red-600' : 'text-gray-900'}`}>
                    {establishment?.subscription?.status === 'active' ? 'Ativo' : 
                     establishment?.subscription?.status === 'cancelled' ? 'Cancelado' : 'Em Teste'}
                  </p>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {establishment?.subscription?.status === 'active'
                      ? 'Assinatura liberada para uso'
                      : establishment?.subscription?.status === 'cancelled'
                      ? 'Seu sistema será bloqueado ao vencer'
                      : 'Periodo gratuito ativo'}
                  </p>
                </div>

                <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Uso do Mes</p>
                  <p className="mt-4 text-2xl font-black text-gray-900">
                    {monthlyAppointmentsCount}
                    {monthlyPlanLimit ? `/${monthlyPlanLimit}` : ''}
                  </p>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {monthlyPlanLimit ? 'Agendamentos consumidos no periodo atual' : 'Agendamentos com uso ilimitado'}
                  </p>
                </div>

                <div className="rounded-[2rem] border border-gray-100 bg-gray-50/70 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Renovacao</p>
                  <p className={`mt-4 text-2xl font-black ${establishment?.subscription?.status === 'cancelled' ? 'text-red-600' : 'text-gray-900'}`}>
                    {establishment?.subscription?.status === 'active' ? 'Mensal' : 
                     establishment?.subscription?.status === 'cancelled' ? 'Encerrando' : 'Teste'}
                  </p>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {establishment?.subscription?.status === 'active'
                      ? `Renova em ${format(safeToDate(establishment.subscription.current_period_end), "dd 'de' MMM", { locale: ptBR })}`
                      : establishment?.subscription?.status === 'cancelled'
                      ? `Vence em ${format(safeToDate(establishment.subscription.current_period_end), "dd 'de' MMM", { locale: ptBR })}`
                      : `Termina em ${format(safeToDate(establishment.subscription.trial_ends_at), "dd 'de' MMM", { locale: ptBR })}`}
                  </p>
                </div>
              </div>

              {monthlyPlanLimit ? (
                <div className={`rounded-[2rem] border p-5 ${
                  usagePercent >= 90 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                        usagePercent >= 90 ? 'bg-red-100 text-red-600' : 'bg-white text-blue-600'
                      }`}>
                        <Info size={20} />
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${usagePercent >= 90 ? 'text-red-600' : 'text-blue-600'}`}>
                          Limite do Plano Essencial
                        </p>
                        <p className={`mt-1 text-sm font-bold ${usagePercent >= 90 ? 'text-red-700' : 'text-blue-700'}`}>
                          Voce usou {monthlyAppointmentsCount} de {monthlyPlanLimit} agendamentos neste mes.
                        </p>
                        <p className={`text-xs font-bold mt-1 opacity-80 ${usagePercent >= 90 ? 'text-red-700' : 'text-blue-700'}`}>
                          Utilizacao atual: {usagePercent}% do limite mensal.
                        </p>
                      </div>
                    </div>

                    {recommendedUpgrade && (
                      <button
                        onClick={() => setView('planos_assinatura')}
                        className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          usagePercent >= 90
                            ? 'bg-white text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        Upgrade para {recommendedUpgrade.name}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 h-3 rounded-full bg-white/80 overflow-hidden border border-white">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usagePercent >= 90 ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white text-emerald-600 flex items-center justify-center">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Uso Ilimitado</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700">
                        Seu plano atual nao possui limite mensal de agendamentos.
                      </p>
                      <p className="text-xs font-bold text-emerald-700/80 mt-1">
                        Voce pode seguir usando todos os recursos liberados pelo seu plano.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(view === 'planos_assinatura' || (view === 'assinatura' && !hasActiveSubscription)) && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-600">Planos de Assinatura</p>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight mt-2">
                  {hasActiveSubscription ? 'Upgrade de Plano' : 'Escolha Seu Plano'}
                </h2>
                <p className="text-gray-500 font-medium max-w-xl mt-2">
                  {hasActiveSubscription
                    ? 'Escolha um plano superior para liberar mais recursos e agendamentos ilimitados.'
                    : 'Seu teste gratuito esta ativo. Escolha um plano para continuar usando todos os recursos sem interrupcao.'}
                </p>
              </div>
              {hasActiveSubscription && (
                <button
                  onClick={() => setView('assinatura')}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[11px] hover:bg-gray-50 transition-all"
                >
                  Voltar para Assinatura
                </button>
              )}
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
                      disabled={establishment?.subscription?.status === 'active' && plan.id === userPlan}
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                        establishment?.subscription?.status === 'active' && plan.id === userPlan
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : plan.popular ? 'bg-pink-600 text-white shadow-lg shadow-pink-200 hover:bg-pink-700' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                      onClick={async () => {
                        if (establishment?.subscription?.status === 'active' && plan.id === userPlan) return;
                        try {
                          showToast(`Iniciando checkout do plano ${plan.name}...`);
                          const pref = await subscriptionService.createPaymentPreference(establishment, plan.id, user.email);
                          
                          if (pref.init_point) {
                            window.location.href = pref.init_point;
                          }
                        } catch (error) {
                          console.error("Erro completo:", error);
                          showToast("Erro ao processar pagamento. Verifique o console.", "error");
                        }
                      }}
                    >
                      {establishment?.subscription?.status === 'active' && plan.id === userPlan ? 'Plano Atual' : 'Assinar Agora'}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">Minha Equipe</h2>
                  <p className="text-gray-500 font-medium">Adicione e gerencie os profissionais da sua estética.</p>
                </div>
                <button 
                  onClick={() => {
                    const teamLimit = userPlan === 'bronze' ? 1 : userPlan === 'silver' ? 3 : 7;
                    const currentTeamCount = team.length + 1; // Inclui a dona
                    
                    if (!hasAccess('equipe')) {
                      showToast(`Seu plano ${PLANS.find(p => p.id === userPlan)?.name} atingiu o limite de ${teamLimit} membros!`, "error");
                      setView('assinatura');
                      return;
                    }
                    
                    setEditingMemberId(null);
                    setNewMember({ nome: '', cargo: '', foto: '', servicos: [], email: '', password: '' });
                    setIsTeamModalOpen(true);
                  }}
                  className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                    !hasAccess('equipe')
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-slate-950 text-white hover:bg-slate-800 shadow-slate-100'
                  }`}
                >
                  {!hasAccess('equipe') ? <Lock size={14} /> : <Plus size={16} />}
                  Adicionar Profissional
                </button>
              </div>

              {team.length === 0 ? (
                <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                    <Users size={40} />
                  </div>
                  <p className="text-gray-400 font-medium">Você é o único profissional cadastrado no momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Card da Dona (Sempre a primeira) */}
                  <div className="bg-white p-6 rounded-[2rem] border border-pink-100 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center gap-4">
                      <div className="relative group/photo shrink-0">
                        <ProfessionalAvatar 
                          foto={profileInfo.photoURL || profileInfo.logo_url} 
                          nome={profileInfo.nome} 
                        />
                        {user?.tipo === 'admin' && (
                          <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/photo:opacity-100 transition-all flex items-center justify-center cursor-pointer rounded-2xl">
                            <Camera size={20} />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => handleUploadProfessionalPhoto(e.target.files[0], 'owner')}
                            />
                          </label>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-900 truncate">{profileInfo.nome}</h4>
                        <p className="text-xs text-pink-600 font-black uppercase tracking-widest">Dona / Admin</p>
                      </div>
                    </div>
                  </div>

                  {/* Cards da Equipe */}
                  {team.map((member) => (
                    <div key={member.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-pink-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="relative group/photo shrink-0">
                          <ProfessionalAvatar 
                            foto={member.foto} 
                            nome={member.nome} 
                            isUploading={professionalPhotoUploading === member.id}
                          />
                          {user?.tipo === 'admin' && (
                            <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/photo:opacity-100 transition-all flex items-center justify-center cursor-pointer rounded-2xl">
                              <Camera size={20} />
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleUploadProfessionalPhoto(e.target.files[0], member.id)}
                              />
                            </label>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-800 truncate">{member.nome}</h4>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{member.cargo}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {user?.tipo === 'admin' && (
                            <button 
                              onClick={() => handleEditTeamMember(member)}
                              className="p-2 text-gray-300 hover:text-pink-600 transition-colors"
                              title="Editar Profissional"
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const message = `Olá ${member.nome}! ✨ Seu acesso profissional no Musa Agenda está pronto.\n\n📧 Login: ${member.email}\n🔑 Senha: ${member.password || '(A senha que você criou)'}\n\nAcesse em: ${window.location.origin}/login`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                            }}
                            className="p-2 text-gray-300 hover:text-emerald-500 transition-colors"
                            title="Enviar Acesso via WhatsApp"
                          >
                            <ExternalLink size={18} />
                          </button>
                          {user?.tipo === 'admin' && (
                            <button 
                              onClick={() => handleDeleteTeamMember(member.id, member.email)}
                              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {/* VIEW: CLIENTES */}
        {view === 'clientes' && (
          user?.tipo === 'staff' ? (
            <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                <Shield size={40} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Acesso Restrito</h3>
              <p className="text-gray-500 font-medium max-w-sm">
                A gestão completa da base de clientes é permitida apenas para a Dona do estabelecimento.
              </p>
            </div>
          ) : (
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
                            if (expandedClientId === client.uid) {
                              setExpandedClientId(null);
                            } else {
                              setExpandedClientId(client.uid);
                              setActiveClientTab('detalhes');
                              setClientAnamnesis([]);
                              setSelectedClientAnamnesis(null);
                            }
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
                                      onClick={() => {
                                        setActiveClientTab('detalhes');
                                        setSelectedClientAnamnesis(null);
                                      }}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeClientTab === 'detalhes' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    >
                                      Detalhes
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveClientTab('historico');
                                        setSelectedClientAnamnesis(null);
                                      }}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeClientTab === 'historico' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    >
                                      Histórico
                                    </button>
                                    <button
                                      data-anamnesis-refresh={client.uid}
                                      onClick={async () => {
                                        setActiveClientTab('anamnese');
                                        setSelectedClientAnamnesis(null);
                                        setLoadingClientAnamnesis(true);
                                        try {
                                          // Busca por UID e também por Telefone (caso seja cliente manual)
                                          const identifiers = [client.uid];
                                          if (client.telefone) {
                                            const cleanPhone = client.telefone.replace(/\D/g, '');
                                            if (cleanPhone) identifiers.push(cleanPhone);
                                          }
                                          const responses = await anamnesisService.getResponsesByCustomer(establishment.id, identifiers);
                                          setClientAnamnesis(responses);
                                        } catch (error) {
                                          console.error("Erro ao carregar anamnese:", error);
                                        } finally {
                                          setLoadingClientAnamnesis(false);
                                        }
                                      }}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeClientTab === 'anamnese' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    >
                                      Anamnese
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
                                  ) : activeClientTab === 'historico' ? (
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                                      {client.appointments?.length > 0 ? (
                                        client.appointments.slice(0, 3).map((app, idx) => (
                                          <div key={idx} className="flex items-center justify-between gap-4 p-2 bg-white rounded-xl shadow-sm border border-gray-50">
                                            <div className="min-w-0">
                                              <p className="text-xs font-black text-gray-800 truncate">{app.service_nome || app.serviceName}</p>
                                              <div className="flex items-center gap-2">
                                                <p className="text-[10px] font-bold text-gray-400">
                                                  {format(safeToDate(app.data_hora), "dd 'de' MMMM", { locale: ptBR })}
                                                </p>
                                                {app.professional_id && (
                                                  <>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <p className="text-[10px] font-black text-pink-500 uppercase tracking-tighter">
                                                      {allProfessionals.find(p => p.id === app.professional_id)?.nome || 'Profissional'}
                                                    </p>
                                                  </>
                                                )}
                                              </div>
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
                                  ) : (
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                                      {/* Cabeçalho da Aba Anamnese */}
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fichas de Anamnese</h4>
                                        <button
                                          onClick={async () => {
                                            const templates = await anamnesisService.getTemplates(establishment.id);
                                            setAnamnesisTemplates(templates);
                                            setAnamnesisCustomerId(client.uid);
                                            setIsSelectingTemplate(true);
                                          }}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-pink-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all shadow-sm active:scale-95"
                                        >
                                          <Plus size={12} strokeWidth={3} />
                                          Nova Ficha
                                        </button>
                                      </div>

                                      {selectedClientAnamnesis ? (
                                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                                          <div className="flex items-center justify-between px-2">
                                            <div>
                                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{selectedClientAnamnesis.template_nome}</h4>
                                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Preenchida em {format(selectedClientAnamnesis.createdAt?.toDate ? selectedClientAnamnesis.createdAt.toDate() : new Date(selectedClientAnamnesis.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                                              </p>
                                            </div>
                                            <button 
                                              onClick={() => setSelectedClientAnamnesis(null)}
                                              className="text-[9px] font-black uppercase text-pink-600 hover:text-pink-700"
                                            >
                                              Voltar à lista
                                            </button>
                                          </div>

                                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                            {selectedClientAnamnesis.respostas && Object.entries(selectedClientAnamnesis.respostas).map(([qId, data], idx) => {
                                              // Suporta tanto o formato novo (objeto com enunciado) quanto o antigo (valor direto)
                                              const enunciado = typeof data === 'object' && data.enunciado ? data.enunciado : `Pergunta ${idx + 1}`;
                                              const answer = typeof data === 'object' && data.enunciado ? data.resposta : data;

                                              return (
                                                <div key={qId} className="space-y-1.5">
                                                  <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-black text-pink-500 mt-0.5">{idx + 1}.</span>
                                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-tight">{enunciado}</p>
                                                  </div>
                                                  <div className="pl-4">
                                                    <div className="text-xs font-bold text-slate-600 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed shadow-sm">
                                                      {Array.isArray(answer) ? answer.join(', ') : (
                                                        typeof answer === 'object' && answer !== null 
                                                        ? `${answer.choice}${answer.choice === 'Sim' ? `: ${answer.text}` : ''}`
                                                        : (answer || 'Não respondido')
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {loadingClientAnamnesis ? (
                                            <div className="py-8 flex flex-col items-center justify-center gap-2">
                                              <div className="w-6 h-6 border-2 border-pink-100 border-t-pink-600 rounded-full animate-spin" />
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando fichas...</p>
                                            </div>
                                          ) : clientAnamnesis.length > 0 ? (
                                            clientAnamnesis.map((resp) => (
                                              <div key={resp.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center shrink-0">
                                                    <ClipboardList size={20} />
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">{resp.template_nome || 'Ficha de Anamnese'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                      {format(resp.createdAt?.toDate ? resp.createdAt.toDate() : new Date(resp.createdAt), "dd/MM/yyyy")}
                                                    </p>
                                                  </div>
                                                </div>
                                                <button 
                                                  onClick={() => setSelectedClientAnamnesis(resp)}
                                                  className="px-4 py-2 bg-pink-50 text-pink-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                                                >
                                                  Ver
                                                </button>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="py-8 text-center space-y-2">
                                              <div className="w-12 h-12 bg-gray-100 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                                                <ClipboardList size={24} />
                                              </div>
                                              <p className="text-xs font-bold text-gray-400">Nenhuma ficha preenchida para esta cliente.</p>
                                            </div>
                                          )}
                                        </div>
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
          )
        )}

        {/* VIEW: AGENDA */}
        {view === 'agenda' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Agenda</h2>
                <p className="text-gray-500 font-medium">Visualize e gerencie todos os agendamentos.</p>
              </div>

              {/* Toggle Visualização */}
              <div className="flex bg-white p-1.5 rounded-2xl border border-pink-100 w-fit shadow-sm">
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
            </div>

            {/* Filtro de Profissional - Oculto para membros da equipe (staff) pois eles já veem apenas sua própria agenda */}
            {user?.tipo !== 'staff' && (
              <div className="bg-white p-4 rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button 
                    onClick={() => setProfessionalFilter('all')}
                    className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                      professionalFilter === 'all' 
                        ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-100' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-pink-200'
                    }`}
                  >
                    Toda a Equipe
                  </button>
                  {allProfessionals.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setProfessionalFilter(p.id)}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                        professionalFilter === p.id 
                          ? 'bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-100' 
                          : 'bg-white border-gray-100 text-gray-400 hover:border-pink-200'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                <div className="bg-white p-4 sm:p-6 rounded-[2.5rem] border border-pink-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
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
                    <div className="text-center min-w-[140px]">
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

                  <button 
                    onClick={() => {
                      setManualAppData(prev => ({ 
                        ...prev, 
                        data_hora: format(selectedDate, "yyyy-MM-dd'T'HH:mm"),
                        professional_id: user?.tipo === 'staff' ? user.professional_id : ''
                      }));
                      setIsManualAppModalOpen(true);
                    }}
                    className="w-full sm:w-auto bg-slate-950 text-white px-5 py-4 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
                  >
                    <Plus size={16} strokeWidth={3} />
                    <span>Agendar Manual</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {appointments.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-pink-100">
                      <Calendar size={48} className="mx-auto text-pink-100 mb-4" />
                      <p className="text-gray-400">Nenhum agendamento nesta data.</p>
                    </div>
                  ) : (
                    appointments.map(app => {
                      const isCombo = app.services && Array.isArray(app.services) && app.services.length > 1;
                      const staffView = user?.tipo === 'staff';
                      const myServiceInCombo = staffView && isCombo ? app.services.find(s => s.professional_id === user.professional_id) : null;
                      
                      // Conversão segura de data para evitar RangeError
                      const appStartTime = myServiceInCombo 
                        ? (myServiceInCombo.start_time?.toDate ? myServiceInCombo.start_time.toDate() : new Date(myServiceInCombo.start_time)) 
                        : safeToDate(app.data_hora);
                      
                      const isValidDate = appStartTime instanceof Date && !isNaN(appStartTime.getTime());
                      const appDuration = myServiceInCombo ? myServiceInCombo.duracao : app.duration;

                      return (
                        <div 
                          key={app.id} 
                          onClick={() => {
                            setSelectedApp(app);
                            setIsAppDetailsModalOpen(true);
                          }}
                          className={`bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-2 shadow-sm transition-all cursor-pointer hover:border-pink-200 ${
                            normalizeStatus(app.status) === APPOINTMENT_STATUS.CANCELLED ? 'opacity-50 grayscale border-gray-100' : 'border-pink-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex gap-3 sm:gap-6 items-center">
                              <div className="text-center min-w-[60px] sm:min-w-[70px] border-r border-pink-100 pr-3 sm:pr-6">
                                <span className="block text-xl sm:text-2xl font-black text-pink-600">
                                  {isValidDate ? format(appStartTime, "HH:mm") : "--:--"}
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{appDuration} MIN</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-lg text-gray-800">{app.user_nome}</h3>
                                  <div className="flex gap-1.5">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      (normalizeStatus(app.status) === APPOINTMENT_STATUS.SCHEDULED || normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED) ? 'bg-green-100 text-green-700' : 
                                      normalizeStatus(app.status) === APPOINTMENT_STATUS.COMPLETED ? 'bg-blue-100 text-blue-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {normalizeStatus(app.status) === APPOINTMENT_STATUS.SCHEDULED ? 'Agendado' : normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED ? 'Confirmado' : normalizeStatus(app.status) === APPOINTMENT_STATUS.COMPLETED ? 'Finalizado' : 'Cancelado'}
                                    </span>
                                    {isCombo && (
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-600 text-white shadow-sm shadow-pink-100 flex items-center gap-1">
                                        <PlusCircle size={10} strokeWidth={3} /> Combo
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-500 flex items-center gap-1 font-medium">
                                  <Sparkles size={14} className="text-pink-400" /> {myServiceInCombo ? myServiceInCombo.service_nome || myServiceInCombo.nome : app.service_nome}
                                </p>
                                {!staffView && app.professional_id && (
                                  <p className="text-[10px] font-black text-pink-600 uppercase tracking-tighter mt-1 bg-pink-50 w-fit px-2 py-0.5 rounded-md">
                                    {allProfessionals.find(p => p.id === app.professional_id)?.nome || 'Profissional'}
                                  </p>
                                )}
                                {staffView && isCombo && (
                                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    Horário Global: {isValidDate ? format(safeToDate(app.data_hora), "HH:mm") : "--:--"}
                                  </p>
                                )}
                              </div>
                            </div>
                            {(normalizeStatus(app.status) === APPOINTMENT_STATUS.SCHEDULED || normalizeStatus(app.status) === APPOINTMENT_STATUS.CONFIRMED) && (
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
                      );
                    })
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
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setShowWeeklyEditor(!showWeeklyEditor);
                    setShowIntervalEditor(false);
                  }}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
                    showWeeklyEditor 
                    ? 'bg-slate-900 text-white shadow-slate-200' 
                    : 'bg-white border-2 border-pink-100 text-pink-600 hover:bg-pink-50 shadow-pink-100'
                  }`}
                >
                  <Calendar size={20} />
                  <span>{showWeeklyEditor ? 'Voltar para Calendário' : 'Escala Semanal'}</span>
                </button>
                
                {!showWeeklyEditor && (
                  <button 
                    onClick={() => {
                      setShowIntervalEditor(!showIntervalEditor);
                      setShowWeeklyEditor(false);
                    }}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
                      showIntervalEditor 
                      ? 'bg-slate-900 text-white shadow-slate-200' 
                      : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-indigo-100'
                    }`}
                  >
                    <Clock size={20} />
                    <span>{showIntervalEditor ? 'Voltar para Calendário' : 'Grade de Horários'}</span>
                  </button>
                )}
              </div>
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
              ) : showIntervalEditor ? (
                <motion.div 
                  key="interval"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-indigo-100 shadow-sm"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Intervalo de Agendamento</h3>
                      <p className="text-sm text-gray-500">Defina de quanto em quanto tempo novos horários podem começar.</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[15, 30, 45, 60].map((interval) => (
                        <button
                          key={interval}
                          onClick={() => setTempInterval(interval)}
                          className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 ${
                            tempInterval === interval
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]'
                            : 'bg-gray-50 border-transparent text-gray-500 hover:bg-white hover:border-indigo-200'
                          }`}
                        >
                          <span className="text-3xl font-black">{interval}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">minutos</span>
                        </button>
                      ))}
                    </div>

                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                      <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                        <strong>Dica:</strong> Se você escolher 15 minutos, suas clientes terão opções como 08:00, 08:15, 08:30. 
                        Se escolher 60 minutos, as opções serão apenas em horas cheias (08:00, 09:00, etc).
                      </p>
                    </div>

                    <button
                      onClick={handleSaveInterval}
                      disabled={isSavingInterval || tempInterval === establishment?.settings?.slot_interval}
                      className="w-full flex items-center justify-center gap-3 p-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-100"
                    >
                      {isSavingInterval ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                      ) : (
                        <Save size={18} />
                      )}
                      {isSavingInterval ? 'Salvando...' : 'Salvar Configuração de Grade'}
                    </button>
                  </div>
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

        {/* VIEW: ANAMNESE */}
        {view === 'anamnese' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AnamnesisManager 
              establishment={establishment} 
              user={user} 
              allAppointments={allAppointments}
            />
          </div>
        )}

        {/* VIEW: LEMBRETES */}
        {view === 'lembretes' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ReminderManager 
              establishment={establishment} 
              allAppointments={allAppointments}
            />
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

              {user?.tipo === 'admin' && (
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
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.length === 0 ? (
                <div className="sm:col-span-2 bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={40} />
                  </div>
                  <p className="text-gray-400 font-medium">Nenhum serviço cadastrado.</p>
                  {user?.tipo === 'admin' && (
                    <button
                      onClick={() => setIsServiceModalOpen(true)}
                      className="mt-4 text-pink-600 font-bold text-sm hover:underline"
                    >
                      Cadastrar seu primeiro serviço
                    </button>
                  )}
                </div>
              ) : (
                services.map(s => (
                  <div key={s.id} className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-pink-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-base sm:text-lg">{s.nome}</h4>
                        {s.prioridade === 1 && (
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-600 text-[8px] font-black uppercase tracking-widest rounded-md">Prioridade</span>
                        )}
                      </div>
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
                    {user?.tipo === 'admin' && (
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
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW: CONFIG */}
        {view === 'config' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-4">
            
            {/* Perfil do Profissional (Identificação) */}
            {user?.tipo === 'staff' && (
              <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden p-6 sm:p-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-[2rem] overflow-hidden bg-pink-50 border-2 border-pink-100 shrink-0">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-pink-600 font-black text-3xl">
                        {user?.nome?.charAt(0) || 'P'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">Painel do Profissional</p>
                    <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase truncate">{user?.nome}</h3>
                    {user?.professional_id && (
                      <div className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-100 mt-2">
                        <Sparkles size={12} className="mr-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {team.find(p => p.id === user.professional_id)?.cargo || 'Especialista'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {user?.tipo === 'admin' && (
              <>
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
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Identidade do Salão */}
                <form onSubmit={saveSettings} className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
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
                                  onChange={e => setProfileInfo({...profileInfo, telefone: maskPhone(e.target.value)})}
                                  className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
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
                          <button type="submit" className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 shadow-lg transition-all">
                            Salvar Identidade
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>

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
                        <p className="text-xs sm:text-sm text-gray-500">Regras de cancelamento e atraso.</p>
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
              </>
            )}

            {/* Segurança (Troca de Senha) - Para Todos */}
            <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenConfigSection(openConfigSection === 'security' ? null : 'security')}
                className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                    <Lock size={20} sm:size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">Segurança</h3>
                    <p className="text-xs sm:text-sm text-gray-500">Altere sua senha de acesso.</p>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'security' ? 'rotate-90' : ''}`}>
                  <ChevronRight size={18} />
                </div>
              </button>

              <AnimatePresence>
                {openConfigSection === 'security' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <form onSubmit={handleUpdatePassword} className="px-6 pb-8 sm:px-8 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Senha Atual</label>
                        <input 
                          type="password"
                          required
                          value={passwordData.currentPassword}
                          onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                          placeholder="Sua senha atual"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nova Senha</label>
                        <input 
                          type="password"
                          required
                          minLength={6}
                          value={passwordData.newPassword}
                          onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Confirmar Nova Senha</label>
                        <input 
                          type="password"
                          required
                          minLength={6}
                          value={passwordData.confirmPassword}
                          onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                          placeholder="Repita a nova senha"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isUpdatingPassword}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Zona de Perigo para Staff */}
            {user?.tipo === 'staff' && (
              <div className="bg-rose-50 p-6 rounded-[2.5rem] border-2 border-dashed border-rose-200">
                <h4 className="text-rose-800 font-black text-lg uppercase tracking-tight mb-2">Sair da Equipe</h4>
                <p className="text-rose-600 text-sm font-medium mb-4">
                  Ao sair, você perderá acesso imediato a este painel. Esta ação não pode ser desfeita.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("Tem certeza que deseja sair desta equipe?")) return;
                    try {
                      if (user.professional_id) await deleteDoc(doc(db, "professionals", user.professional_id));
                      await updateDoc(doc(db, "users", user.uid), { tipo: 'cliente', establishment_id: null, professional_id: null });
                      window.location.reload();
                    } catch (error) {
                      showToast("Erro ao sair da equipe.", "error");
                    }
                  }}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  Sair da Equipe Agora
                </button>
              </div>
            )}
          </div>
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
      </div>
    </SubscriptionGuard>
  );
}
