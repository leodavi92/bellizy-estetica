import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getEstablishmentBySlug } from '../services/establishmentService';
import { anamnesisService } from '../services/anamnesisService';
import AnamnesisForm from '../components/client/AnamnesisForm';
import { motion } from 'framer-motion';
import { CheckCircle2, Home } from 'lucide-react';

export default function ClientAnamnesisPage() {
  const { slug, appointmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [template, setTemplate] = useState(null);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // 1. Busca estabelecimento
        const est = await getEstablishmentBySlug(slug);
        if (!est) {
          setError("Estabelecimento não encontrado.");
          return;
        }
        setEstablishment(est);

        // 2. Busca agendamento
        const appRef = doc(db, 'appointments', appointmentId);
        const appSnap = await getDoc(appRef);
        if (!appSnap.exists()) {
          setError("Agendamento não encontrado.");
          return;
        }
        const appData = { id: appSnap.id, ...appSnap.data() };
        setAppointment(appData);

        // 3. Busca template (pela URL query ou o primeiro do estabelecimento)
        const params = new URLSearchParams(window.location.search);
        const templateId = params.get('templateId');
        
        const templates = await anamnesisService.getTemplates(est.id);
        if (templates.length === 0) {
          setError("Nenhum modelo de anamnese disponível.");
          return;
        }

        let selectedTemplate = templates[0];
        if (templateId) {
          selectedTemplate = templates.find(t => t.id === templateId) || templates[0];
        }
        setTemplate(selectedTemplate);

        // 4. Verifica se este modelo específico já foi preenchido para este agendamento
        const existingResponse = await anamnesisService.getResponseByAppointment(appointmentId, selectedTemplate.id);
        if (existingResponse) {
          setAlreadyFilled(true);
          setLoading(false);
          return;
        }

      } catch (err) {
        console.error("Erro ao carregar dados da anamnese:", err);
        setError("Erro ao carregar a página.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug, appointmentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-pink-100 border-t-pink-600 animate-spin rounded-full" />
      </div>
    );
  }

  if (completed || alreadyFilled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[3rem] p-10 text-center shadow-xl shadow-slate-200/50"
        >
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
            {alreadyFilled ? "Ficha já Preenchida" : "Tudo Pronto!"}
          </h2>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            {alreadyFilled 
              ? "Esta ficha de anamnese já foi preenchida anteriormente. Obrigado!" 
              : "Suas respostas foram enviadas com sucesso e já estão disponíveis para a profissional."}
          </p>
          <button 
            onClick={() => navigate(`/${slug}`)}
            className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
          >
            <Home size={18} />
            Voltar para Início
          </button>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-10 text-center">
          <p className="text-red-500 font-bold mb-4">{error}</p>
          <button onClick={() => navigate(`/${slug}`)} className="text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const customerId = appointment.user_id || (appointment.user_telefone ? appointment.user_telefone.replace(/\D/g, '') : null);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 overflow-hidden">
        <AnamnesisForm 
          template={template}
          appointmentId={appointmentId}
          customerId={customerId}
          establishmentId={establishment.id}
          onComplete={() => setCompleted(true)}
          onCancel={() => navigate(`/${slug}`)}
        />
      </div>
    </div>
  );
}
