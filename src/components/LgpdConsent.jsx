import { useEffect, useState } from 'react';
import { Cookie, X, FileText, Scale, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserDoc } from '../services/firebase';

/**
 * ====================
 *  LGPD CONSENT (M5)
 * ====================
 * Banner e modal global de conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
 *
 * Funcionamento:
 *   - Renderizado NO TOPO da árvore (App.jsx) → visível em qualquer rota pública ou privada.
 *   - Mostra o BANNER somente se `musa_lgpd_consent_v1` NÃO existir no localStorage.
 *   - Quando o usuário ACEITA, grava timestamp e versão no localStorage.
 *   - A qualquer momento, usuário pode ver POLÍTICA / TERMOS pelos links no rodapé (chama showPrivacy/showTerms).
 *   - É um componente SEM ESTADO GLOBAL (não depende de context), só lê/escreve localStorage.
 */

const LS_KEY = 'musa_lgpd_consent_v1';

const writeConsent = (version = 1) => {
  try {
    const payload = JSON.stringify({
      version,
      acceptedAt: new Date().toISOString(),
      source: 'banner',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    localStorage.setItem(LS_KEY, payload);
    return payload;
  } catch {
    // localStorage indisponível (privacy mode) — não bloqueia UX.
    return null;
  }
};

const hasConsent = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    return p && p.version >= 1 && p.acceptedAt;
  } catch {
    return false;
  }
};

/**
 * Texto-base da Política de Privacidade e Termos de Uso do Musa Agenda.
 * A dona do SaaS deve revisar, em especial:
 *   - Razão social / CNPJ do responsável legal
 *   - DPO / contato de privacidade
 *   - Menções a integrações específicas (Mercado Pago, Resend, etc)
 */
const PRIVACY_TEXT = [
  {
    h: '1. Responsável pelo Tratamento de Dados',
    p: 'O Musa Agenda é operado pela pessoa jurídica proprietária da plataforma. Qualquer dúvida de privacidade pode ser encaminhada ao e-mail de contato disponível no painel do estabelecimento.',
  },
  {
    h: '2. Dados Coletados',
    p: 'São coletados: nome, e-mail, telefone/WhatsApp, IP, dados de agendamento (serviços, horários, profissional), dados de pagamento (processados via Mercado Pago) e, opcionalmente, respostas de anamnese e foto de perfil.',
  },
  {
    h: '3. Finalidade do Tratamento',
    p: 'Os dados são usados para viabilizar agendamentos, emitir lembretes, emitir notas fiscais, conformidade financeira, segurança da conta e melhorias no produto.',
  },
  {
    h: '4. Cookies e Rastreamento',
    p: 'O Musa Agenda usa cookies estritamente necessários (autenticação Firebase, preferências de usuário e PWA). Não utilizamos cookies publicitários de terceiros.',
  },
  {
    h: '5. Compartilhamento com Terceiros',
    p: 'Dados são compartilhados apenas com: Firebase/GCP (hospedagem e autenticação), Mercado Pago (pagamentos), Resend (e-mails transacionais). Todos operam sob contrato de processamento.',
  },
  {
    h: '6. Retenção',
    p: 'Dados de agendamento e clientes são mantidos pelo prazo mínimo legal (5 anos para fiscais). O usuário pode solicitar exclusão a qualquer momento via painel.',
  },
  {
    h: '7. Direitos do Titular (LGPD, art. 18)',
    p: 'Você pode solicitar: confirmação de tratamento, acesso, correção, anonimização/exclusão, portabilidade e revogação de consentimento. Entre em contato com a clínica onde realizou o agendamento ou com o responsável legal do Musa Agenda.',
  },
  {
    h: '8. Consentimento',
    p: 'Ao marcar um horário ou criar uma conta, você declara ter lido e concordado com esta Política de Privacidade e com os Termos de Uso.',
  },
];

const TERMS_TEXT = [
  {
    h: '1. Objeto',
    p: 'O Musa Agenda é uma plataforma SaaS de agendamento online para clínicas de estética e salões de beleza, oferecida sob o modelo de assinatura mensal.',
  },
  {
    h: '2. Planos e Pagamento',
    p: 'Essencial (R$19,99/mês), Profissional (R$29,99/mês) e Premium VIP (R$44,99/mês). Pagamentos via Mercado Pago. Cancelamento a qualquer momento no painel de Assinaturas, sem multas. Trial de 15 dias no primeiro cadastro.',
  },
  {
    h: '3. Uso Permitido',
    p: 'O assinante pode cadastrar profissionais, clientes, serviços e horários do seu próprio estabelecimento. É proibida a revenda, engenharia reversa ou uso para concorrência desleal.',
  },
  {
    h: '4. Disponibilidade e SLA',
    p: 'Buscamos disponibilidade mínima de 99,5% ao mês. Manutenções programadas são comunicadas com 24h de antecedência.',
  },
  {
    h: '5. Segurança',
    p: 'Armazenamento em Firebase Firestore com regras de acesso, autenticação por e-mail/senha e Google OAuth, e criptografia em trânsito (HTTPS/TLS 1.3).',
  },
  {
    h: '6. Limitação de Responsabilidade',
    p: 'Em caso de indisponibilidade, a responsabilidade da plataforma limita-se ao valor proporcional da assinatura não usufruído. Não nos responsabilizamos por eventuais perdas indiretas (lucros cessantes).',
  },
  {
    h: '7. Rescisão e Encerramento',
    p: 'O assinante pode cancelar a qualquer momento. Violações graves (spam, uso indevido de dados, etc.) podem resultar em encerramento imediato da conta após aviso prévio por e-mail.',
  },
  {
    h: '8. Foro',
    p: 'Fica eleito o foro da comarca da sede do estabelecimento operador do Musa Agenda, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
  },
];

export default function LgpdConsent() {
  const { user } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!hasConsent()) {
      // Delay de 1.2s para não sobrepor onboarding inicial
      const t = setTimeout(() => setShowBanner(true), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  // ------------------------------------------------------------
  // Escuta o CustomEvent disparado pelo LgpdFooterLinks
  // (ou qualquer outra tela que queira abrir Política / Termos).
  // ------------------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (detail.open === 'privacy') {
        if (!hasConsent()) accept('privacy-link-event');
        setShowTerms(false);
        setShowBanner(false);
        setShowPrivacy(true);
      }
      if (detail.open === 'terms') {
        if (!hasConsent()) accept('terms-link-event');
        setShowPrivacy(false);
        setShowBanner(false);
        setShowTerms(true);
      }
    };
    window.addEventListener('musa:lgpd', handler);
    return () => window.removeEventListener('musa:lgpd', handler);
  }, [user]);

  const persistServerSide = async (payload) => {
    if (!user?.uid) return;
    try {
      await updateUserDoc(user.uid, {
        aceitou_lgpd_em: payload.acceptedAt,
        aceitou_lgpd_version: payload.version,
        aceitou_lgpd_source: payload.source,
        aceitou_lgpd_ua: payload.userAgent
      });
    } catch (err) {
      // Evita quebrar UX por erro de gravação server-side.
      // O localStorage já foi gravado de qualquer forma.
      console.warn("[LGPD] Aviso: não foi possível salvar consentimento server-side.", err?.message || err);
    }
  };

  const accept = (source = 'banner') => {
    try {
      const payload = {
        version: 1,
        acceptedAt: new Date().toISOString(),
        source,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      persistServerSide(payload);
    } catch {
      // privacy mode: ignore
    }
    setShowBanner(false);
  };

  const openPrivacy = () => {
    if (showBanner) { accept('privacy-link'); }
    setShowTerms(false);
    setShowPrivacy(true);
  };

  const openTerms = () => {
    if (showBanner) { accept('terms-link'); }
    setShowPrivacy(false);
    setShowTerms(true);
  };

  return (
    <>
      {/* ============= BANNER DE CONSENTIMENTO (1a vez) ================= */}
      {showBanner && !showPrivacy && !showTerms && (
        <div className="fixed z-[9998] inset-x-0 bottom-0 px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-4xl rounded-[2rem] border-2 border-slate-950 bg-white p-4 sm:p-6 shadow-2xl shadow-slate-900/10">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-pink-100 border border-pink-200 flex items-center justify-center text-pink-600">
                <Cookie size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black tracking-tight text-slate-900 sm:text-base">
                  Nós cuidamos dos seus dados 🛡️
                </h2>
                <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
                  O Musa Agenda usa cookies estritamente necessários (de sessão e autenticação)
                  para funcionar. Não usamos cookies publicitários. Ao continuar navegando ou
                  clicando em <span className="font-bold text-pink-600">“Aceitar tudo”</span>,
                  você declara ter lido e concordar com nossa{' '}
                  <button
                    type="button"
                    onClick={openPrivacy}
                    className="font-bold text-pink-600 underline underline-offset-2 hover:text-pink-700"
                  >
                    Política de Privacidade
                  </button>{' '}
                  e os{' '}
                  <button
                    type="button"
                    onClick={openTerms}
                    className="font-bold text-pink-600 underline underline-offset-2 hover:text-pink-700"
                  >
                    Termos de Uso
                  </button>
                  .
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => accept('banner-accept')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 active:scale-[0.99]"
                  >
                    <CheckCircle2 size={16} />
                    Aceitar tudo
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => accept('banner-dismiss')}
                aria-label="Fechar aviso de privacidade"
                className="shrink-0 h-10 w-10 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= MODAL: POLÍTICA DE PRIVACIDADE ================= */}
      {showPrivacy && (
        <ModalShell onClose={() => setShowPrivacy(false)} title="Política de Privacidade" icon={<FileText size={20} />} iconBg="bg-pink-100" iconColor="text-pink-600">
          {PRIVACY_TEXT.map((item) => (
            <section key={item.h} className="space-y-1.5">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-pink-600">
                {item.h}
              </h3>
              <p className="text-sm sm:text-[15px] leading-relaxed text-slate-700">{item.p}</p>
            </section>
          ))}
        </ModalShell>
      )}

      {/* ============= MODAL: TERMOS DE USO =========================== */}
      {showTerms && (
        <ModalShell onClose={() => setShowTerms(false)} title="Termos de Uso" icon={<Scale size={20} />} iconBg="bg-rose-100" iconColor="text-rose-600">
          {TERMS_TEXT.map((item) => (
            <section key={item.h} className="space-y-1.5">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-600">
                {item.h}
              </h3>
              <p className="text-sm sm:text-[15px] leading-relaxed text-slate-700">{item.p}</p>
            </section>
          ))}
        </ModalShell>
      )}
    </>
  );
}

/**
 * Links de rodapé (reutilizáveis por qualquer layout público).
 */
export function LgpdFooterLinks({ size = 'sm', className = '' }) {
  const [, forceRender] = useState(0);
  const openPrivacy = () => {
    const event = new CustomEvent('musa:lgpd', { detail: { open: 'privacy' } });
    window.dispatchEvent(event);
    forceRender((n) => n + 1);
  };
  const openTerms = () => {
    const event = new CustomEvent('musa:lgpd', { detail: { open: 'terms' } });
    window.dispatchEvent(event);
    forceRender((n) => n + 1);
  };
  const base = `inline-flex items-center gap-1 font-bold text-slate-500 hover:text-pink-600 transition-colors ${size === 'sm' ? 'text-xs' : 'text-sm'} ${className}`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <button type="button" onClick={openPrivacy} className={base}>
        <FileText size={size === 'sm' ? 12 : 14} />
        Política de Privacidade
      </button>
      <button type="button" onClick={openTerms} className={base}>
        <Scale size={size === 'sm' ? 12 : 14} />
        Termos de Uso
      </button>
    </div>
  );
}

/**
 * Shell do Modal (mesmo visual do sistema, rosa/rose, card 85vh mobile).
 */
function ModalShell({ onClose, title, icon, iconBg = 'bg-pink-100', iconColor = 'text-pink-600', children }) {
  // Event listener para abrir por `LgpdFooterLinks` (dispatched de fora):
  useEffect(() => {
    const handler = () => undefined;
    window.addEventListener('musa:lgpd-modal-noop', handler);
    return () => window.removeEventListener('musa:lgpd-modal-noop', handler);
  }, []);

  return (
    <div
      className="fixed z-[9999] inset-0 flex items-end sm:items-center justify-center px-3 sm:px-6 py-0 sm:py-8 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-t-[2.5rem] sm:rounded-[2.5rem] border-2 border-slate-950 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className={`h-11 w-11 shrink-0 rounded-2xl ${iconBg} border border-white/50 flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate">
              {title}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
              Musa Agenda · LGPD
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="h-10 w-10 shrink-0 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-[calc(85vh-80px)] overflow-y-auto px-5 sm:px-7 py-5 space-y-5 no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
