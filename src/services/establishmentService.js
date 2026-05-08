import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_ESTABLISHMENT_SETTINGS = {
  horario_inicio: '08:00',
  horario_fim: '18:00',
  dias_trabalho: [1, 2, 3, 4, 5, 6]
};

export const sanitizeSlug = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const buildBusinessHoursLabel = (settings = DEFAULT_ESTABLISHMENT_SETTINGS) => {
  const days = settings.dias_trabalho || DEFAULT_ESTABLISHMENT_SETTINGS.dias_trabalho;

  if (days.length === 6 && !days.includes(0)) {
    return `Seg a Sab • ${settings.horario_inicio} às ${settings.horario_fim}`;
  }

  if (days.length === 5 && JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) {
    return `Seg a Sex • ${settings.horario_inicio} às ${settings.horario_fim}`;
  }

  return `${settings.horario_inicio} às ${settings.horario_fim}`;
};

export const normalizeEstablishmentData = (data = {}) => {
  const settings = {
    ...DEFAULT_ESTABLISHMENT_SETTINGS,
    ...(data.settings || {})
  };

  const nome =
    Object.prototype.hasOwnProperty.call(data, 'nome')
      ? data.nome
      : Object.prototype.hasOwnProperty.call(data, 'name')
        ? data.name
        : 'Minha Estetica';
  const telefone = data.telefone || data.phone || '';
  const endereco = data.endereco || data.address || '';
  const descricao =
    data.descricao ||
    data.description ||
    'Especialista em beleza, bem-estar e atendimento profissional com agendamento online.';

  return {
    ...data,
    nome,
    name: nome,
    slug: sanitizeSlug(data.slug || nome || 'estetica'),
    telefone,
    phone: telefone,
    instagram: data.instagram || '',
    descricao,
    logo_url: data.logo_url || '',
    banner_url: data.banner_url || '',
    endereco,
    address: endereco,
    horario_funcionamento: data.horario_funcionamento || buildBusinessHoursLabel(settings),
    politica_cancelamento:
      data.politica_cancelamento ||
      'Cancelamentos e remarcacoes devem ser solicitados com pelo menos 24 horas de antecedencia.',
    settings,
    profile_completed: data.profile_completed ?? false,
    setup_steps: data.setup_steps || {
      info_basica: false,
      logo: false,
      schedule: false,
      first_service: false,
      policy: false
    }
  };
};

export const buildEstablishmentPayload = (adminUid, data = {}) => {
  const normalized = normalizeEstablishmentData(data);

  return {
    owner_id: adminUid,
    nome: normalized.nome,
    name: normalized.nome,
    slug: normalized.slug,
    telefone: normalized.telefone,
    phone: normalized.telefone,
    instagram: normalized.instagram,
    descricao: normalized.descricao,
    logo_url: normalized.logo_url,
    banner_url: normalized.banner_url,
    endereco: normalized.endereco,
    address: normalized.endereco,
    horario_funcionamento: normalized.horario_funcionamento,
    politica_cancelamento: normalized.politica_cancelamento,
    profile_completed: normalized.profile_completed,
    setup_steps: normalized.setup_steps,
    createdAt: data.createdAt || Timestamp.now(),
    settings: normalized.settings
  };
};

export const getInstagramUrl = (instagram = '') => {
  const handle = instagram.replace(/^@/, '').trim();
  return handle ? `https://instagram.com/${handle}` : '';
};

export const getWhatsAppUrl = (phone = '') => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned ? `https://wa.me/${cleaned}` : '';
};

/**
 * Busca um estabelecimento pelo seu slug único
 */
export const getEstablishmentBySlug = async (slug) => {
  const cleanSlug = sanitizeSlug(slug);
  const q = query(collection(db, 'establishments'), where('slug', '==', cleanSlug));
  const snap = await getDocs(q);
  
  if (snap.empty) return null;
  
  const doc = snap.docs[0];
  return normalizeEstablishmentData({ id: doc.id, ...doc.data() });
};

/**
 * Cria um novo estabelecimento
 */
export const createEstablishment = async (adminUid, data) => {
  const establishmentData = buildEstablishmentPayload(adminUid, data);

  const docRef = await addDoc(collection(db, 'establishments'), establishmentData);
  return { id: docRef.id, ...establishmentData };
};

/**
 * Verifica se um slug já está em uso por outro estabelecimento
 */
export const isSlugAvailable = async (slug, currentEstablishmentId = null) => {
  const cleanSlug = sanitizeSlug(slug);
  const q = query(collection(db, 'establishments'), where('slug', '==', cleanSlug));
  const snap = await getDocs(q);
  
  if (snap.empty) return true;
  
  // Se houver um resultado, verificamos se pertence ao estabelecimento atual
  if (currentEstablishmentId) {
    return snap.docs.every(doc => doc.id === currentEstablishmentId);
  }
  
  return false;
};

/**
 * Gera um slug único a partir de um nome, adicionando sufixo se necessário
 */
export const generateUniqueSlug = async (name) => {
  let baseSlug = sanitizeSlug(name);
  let finalSlug = baseSlug;
  let counter = 1;
  
  while (!(await isSlugAvailable(finalSlug))) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return finalSlug;
};
