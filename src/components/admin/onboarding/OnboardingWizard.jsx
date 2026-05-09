import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Image as ImageIcon, 
  MapPin, 
  Clock, 
  PlusCircle, 
  ChevronRight,
  Sparkles,
  ArrowRight,
  X,
  Shield,
  Phone,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from '../../../services/firebase';
import { doc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import BusinessInfoStep from './BusinessInfoStep';
import WeeklyAvailabilityEditor from '../settings/WeeklyAvailabilityEditor';
import CancellationPolicySettings from '../settings/CancellationPolicySettings';

export default function OnboardingWizard({ establishment }) {
  const [activeStep, setActiveStep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Bloquear rolagem do body quando um modal estiver aberto
  useEffect(() => {
    if (activeStep) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [activeStep]);
  
  // Mandatory check: if basic info is missing, force BusinessInfoStep
  const hasBasicInfo = establishment?.nome && establishment?.telefone && establishment?.setup_steps?.info_basica;

  const steps = [
    { 
      id: 'info_basica', 
      title: 'Nome e WhatsApp', 
      desc: 'Dados obrigatórios para sua página.', 
      icon: Store,
      completed: !!hasBasicInfo,
      mandatory: true
    },
    { 
      id: 'schedule', 
      title: 'Horários de Funcionamento', 
      desc: 'Defina quando você atende.', 
      icon: Clock,
      completed: establishment?.setup_steps?.schedule 
    },
    { 
      id: 'first_service', 
      title: 'Primeiro Serviço', 
      desc: 'Cadastre seu serviço principal.', 
      icon: PlusCircle,
      completed: establishment?.setup_steps?.first_service 
    },
    { 
      id: 'policy', 
      title: 'Política de Cancelamento', 
      desc: 'Regras de horários e faltas.', 
      icon: Shield,
      completed: establishment?.setup_steps?.policy 
    },
    { 
      id: 'logo', 
      title: 'Logo da Estética', 
      desc: 'Sua marca visual no topo.', 
      icon: ImageIcon,
      completed: establishment?.setup_steps?.logo 
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Auto-open mandatory step if missing
  useEffect(() => {
    if (!hasBasicInfo) {
      setActiveStep('info_basica');
    }
  }, [hasBasicInfo]);

  const updateStepStatus = async (stepId, isCompleted = true) => {
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      const newSetupSteps = { 
        ...establishment.setup_steps, 
        [stepId]: isCompleted 
      };
      
      // Check if all steps are done to complete profile
      const isAllDone = Object.values(newSetupSteps).every(v => v === true);

      await updateDoc(estRef, {
        [`setup_steps.${stepId}`]: isCompleted,
        profile_completed: isAllDone
      });
      setActiveStep(null);
    } catch (error) {
      console.error("Erro ao atualizar etapa:", error);
    }
  };

  const [service, setService] = useState({ nome: '', duracao: 30, preco: '' });
  const handleSaveService = async () => {
    if (!service.nome.trim() || !service.preco) return alert("Preencha o nome e o preço do serviço.");
    try {
      setLoading(true);
      await addDoc(collection(db, 'services'), {
        ...service,
        duracao: Number(service.duracao),
        preco: Number(service.preco),
        establishment_id: establishment.id,
        createdAt: Timestamp.now()
      });
      await updateStepStatus('first_service');
    } catch (error) {
      alert("Erro ao salvar serviço.");
    } finally {
      setLoading(false);
    }
  };

  const [logoUrl, setLogoUrl] = useState(establishment?.logo_url || '');
  const handleSaveLogo = async () => {
    if (!establishment?.id) return;
    try {
      setLoading(true);
      await updateDoc(doc(db, 'establishments', establishment.id), {
        logo_url: logoUrl,
        [`setup_steps.logo`]: true
      });
      updateStepStatus('logo');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar logo');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !establishment?.id) return;

    try {
      setLogoUploading(true);
      const filePath = `establishments/${establishment.id}/logo-${Date.now()}`;
      const fileRef = storageRef(storage, filePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setLogoUrl(url);
    } catch (error) {
      console.error('Erro ao enviar foto:', error);
      alert('Não foi possível enviar a foto. Verifique sua conexão.');
    } finally {
      setLogoUploading(false);
      // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-pink-50/30 p-4 sm:p-8 relative">
      <div className="max-w-2xl mx-auto space-y-8 py-6">
        
        {/* Welcome Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-1"
        >
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">🎉 Quase lá!</h1>
          <p className="text-gray-500 font-bold text-sm max-w-xs mx-auto leading-relaxed">
            Configure seu espaço para receber agendamentos.
          </p>
        </motion.div>

        {/* Progress Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[2rem] shadow-xl shadow-pink-100/50 border border-white"
        >
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-600">Seu Progresso</span>
              <h2 className="text-xl font-black text-gray-800">{progressPercent}% Completo</h2>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{completedCount}/{steps.length} Etapas</span>
              {completedCount > 0 && completedCount < steps.length && (
                <button
                  onClick={async () => {
                    const estRef = doc(db, 'establishments', establishment.id);
                    await updateDoc(estRef, { profile_completed: true });
                  }}
                  className="text-[9px] font-black uppercase tracking-widest bg-pink-50 text-pink-600 hover:bg-pink-600 hover:text-white px-3 py-1.5 rounded-lg transition-all border border-pink-100 shadow-sm"
                >
                  Pular todas
                </button>
              )}
            </div>
          </div>
          <div className="h-3 bg-pink-50 rounded-full overflow-hidden p-0.5 border border-pink-100">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full shadow-sm"
            />
          </div>
        </motion.div>

        {/* Checklist */}
        <div className="grid gap-3 sm:gap-4 px-2">
          {steps.map((step, index) => (
            <motion.button
              key={step.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => !step.completed && setActiveStep(step.id)}
              disabled={!hasBasicInfo && !step.mandatory}
              className={`w-full flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all text-left relative overflow-hidden group ${
                step.completed 
                ? 'bg-white border-green-100 opacity-60 cursor-default' 
                : !hasBasicInfo && !step.mandatory
                  ? 'bg-gray-100 border-transparent grayscale cursor-not-allowed opacity-50'
                  : 'bg-white border-transparent hover:border-pink-200 shadow-xl shadow-pink-100/20 active:scale-[0.98]'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                step.completed 
                  ? 'bg-green-50 text-green-500' 
                  : 'bg-pink-50 text-pink-500 group-hover:bg-pink-600 group-hover:text-white'
              }`}>
                {step.completed ? <CheckCircle2 size={24} /> : <step.icon size={24} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-black text-base tracking-tight ${step.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {step.title}
                  </h3>
                  {step.mandatory && !step.completed && (
                    <span className="text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Obrigatório</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-bold">{step.desc}</p>
              </div>

              {!step.completed && hasBasicInfo && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Modal Overlay */}
        <AnimatePresence>
            {activeStep && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => hasBasicInfo && setActiveStep(null)}
                  className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
                />
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="relative w-full max-w-[340px] sm:max-w-md bg-white rounded-[2rem] p-5 sm:p-8 shadow-2xl overflow-y-auto max-h-[85vh] no-scrollbar"
                >
                {hasBasicInfo && (
                  <button 
                    onClick={() => setActiveStep(null)}
                    className="absolute right-8 top-8 p-2 text-gray-300 hover:text-gray-600 transition-colors z-10"
                  >
                    <X size={24} />
                  </button>
                )}

                {activeStep === 'info_basica' && (
                  <BusinessInfoStep 
                    establishment={establishment} 
                    onComplete={() => setActiveStep(null)} 
                  />
                )}

                {activeStep === 'schedule' && (
                  <div className="py-4">
                    <div className="text-left mb-6">
                      <h2 className="text-2xl font-black text-gray-800">Horários</h2>
                      <p className="text-sm text-gray-500">Quando você atende?</p>
                    </div>
                    <WeeklyAvailabilityEditor 
                      establishment={establishment} 
                      onSave={() => updateStepStatus('schedule')}
                    />
                  </div>
                )}

                {activeStep === 'policy' && (
                  <div className="py-4">
                    <div className="text-left mb-6">
                      <h2 className="text-2xl font-black text-gray-800">Políticas</h2>
                      <p className="text-sm text-gray-500">Regras de cancelamento.</p>
                    </div>
                    <CancellationPolicySettings 
                      establishment={establishment} 
                      onSave={() => updateStepStatus('policy')}
                    />
                  </div>
                )}

                {activeStep === 'first_service' && (
                  <div className="space-y-6 py-4">
                    <div className="text-left space-y-1 mb-6">
                      <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center">
                        <PlusCircle size={24} />
                      </div>
                      <h2 className="text-xl font-black text-gray-800">Primeiro Serviço</h2>
                      <p className="text-xs text-gray-500 font-medium">O que você oferece?</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Nome do Serviço</label>
                        <input
                          type="text"
                          placeholder="Ex: Limpeza de Pele"
                          value={service.nome}
                          onChange={(e) => setService({ ...service, nome: e.target.value })}
                          className="w-full p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Preço (R$)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={service.preco}
                            onChange={(e) => setService({ ...service, preco: e.target.value })}
                            className="w-full p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2">Duração (min)</label>
                          <select
                            value={service.duracao}
                            onChange={(e) => setService({ ...service, duracao: e.target.value })}
                            className="w-full p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                          >
                            {[15, 30, 45, 60, 90, 120].map(m => (
                              <option key={m} value={m}>{m} min</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveService}
                      disabled={loading}
                      className="w-full p-4 bg-slate-950 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Salvando...' : 'Salvar e Continuar'}
                    </button>
                  </div>
                )}

                {activeStep === 'logo' && (
                  <div className="space-y-6 py-4">
                    <div className="text-left space-y-1 mb-6">
                      <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center">
                        <ImageIcon size={24} />
                      </div>
                      <h2 className="text-xl font-black text-gray-800">Sua Identidade</h2>
                      <p className="text-xs text-gray-500 font-medium">Sua marca no topo.</p>
                    </div>

                    <div className="space-y-6 text-center">
                      <div className="relative group">
                        <div className="w-32 h-32 mx-auto rounded-full border-4 border-white bg-pink-50 p-1 overflow-hidden shadow-xl shadow-pink-100/50 flex items-center justify-center">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Preview" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <div className="w-full h-full rounded-full flex items-center justify-center bg-pink-50 text-pink-300">
                              <ImageIcon size={40} strokeWidth={1.5} />
                            </div>
                          )}
                          
                          {logoUploading && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-full backdrop-blur-[1px]">
                              <div className="w-8 h-8 border-3 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>

                        <label 
                          htmlFor="onboarding-logo-upload"
                          className="absolute bottom-0 right-1/2 translate-x-12 translate-y-1 w-10 h-10 bg-slate-950 text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:bg-slate-800 transition-all active:scale-90"
                        >
                          <PlusCircle size={20} />
                          <input
                            id="onboarding-logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={logoUploading}
                          />
                        </label>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="h-px bg-gray-100 w-full" />
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Ou use um Link da Imagem</label>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveLogo}
                      disabled={loading}
                      className="w-full p-4 bg-slate-950 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
                    >
                      {loading ? 'Salvando...' : 'Salvar Logo'}
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
