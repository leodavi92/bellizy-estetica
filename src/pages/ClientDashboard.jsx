import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  HeartHandshake,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getEstablishmentBySlug
} from '../services/establishmentService';
import EstablishmentHero from '../components/client/EstablishmentHero';

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Agendamento online seguro',
    description: 'Fluxo simples, rapido e confiavel para reservar seu horario.'
  },
  {
    icon: Sparkles,
    title: 'Atendimento profissional',
    description: 'Experiencia pensada para transmitir cuidado, organizacao e excelencia.'
  },
  {
    icon: HeartHandshake,
    title: 'Clientes satisfeitas',
    description: 'Comunicacao clara, servicos bem apresentados e jornada premium.'
  }
];

export default function ClientDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitialData() {
      if (!slug || slug === 'login') return;

      const cleanSlug = slug.replace('estetica/', '');
      localStorage.setItem('last_estetica_slug', cleanSlug);

      try {
        setLoading(true);
        const estData = await getEstablishmentBySlug(cleanSlug);

        if (!estData) {
          setEstablishment('not_found');
          return;
        }

        setEstablishment(estData);

        if (user?.uid && user?.tipo !== 'admin') {
          try {
            await runTransaction(db, async (tx) => {
              const userRef = doc(db, 'users', user.uid);
              const snap = await tx.get(userRef);
              if (!snap.exists()) return;

              const data = snap.data() || {};
              const saved = data.saved_establishments || {};
              const isFirst = !saved || Object.keys(saved).length === 0;

              const establishmentInfo = {
                slug: cleanSlug,
                nome: estData.nome || '',
                logo_url: estData.logo_url || '',
                lastVisitedAt: Date.now()
              };

              if (isFirst) {
                establishmentInfo.favorite = true;
              }

              const updates = {
                last_establishment_slug: cleanSlug,
                [`saved_establishments.${estData.id}`]: establishmentInfo
              };

              tx.update(userRef, updates);
            });
          } catch (e) {
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do estabelecimento:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [slug]);

  const handlePrimaryBooking = () => {
    navigate(`/${slug}/agendar`);
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
        <p className="mt-2 max-w-md text-slate-500">
          O link que você acessou não parece estar correto. Verifique com a profissional.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Ir para o início
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-14">
      <EstablishmentHero
        establishment={establishment}
        onBookClick={handlePrimaryBooking}
        heroSubtitle="Pagina profissional da estetica"
      />

      <section>
        <div className="rounded-[2.25rem] border-2 border-slate-950 bg-white p-6 shadow-2xl shadow-slate-200 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-600">
            Confianca e Credibilidade
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Uma experiencia moderna, comercial e acolhedora desde o primeiro clique
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {trustItems.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border-2 border-slate-100 bg-slate-50/50 p-5 transition-all hover:border-pink-100 hover:bg-white"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm border border-slate-100">
                  <item.icon size={20} />
                </div>
                <h3 className="mt-4 text-sm font-black tracking-tight text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
