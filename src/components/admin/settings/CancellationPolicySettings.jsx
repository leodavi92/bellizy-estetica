import React, { useState, useEffect } from 'react';
import { Shield, Clock, AlertTriangle, Save, CheckCircle2 } from 'lucide-react';
import { db } from '../../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function CancellationPolicySettings({ establishment, onSave }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [policy, setPolicy] = useState({
    min_cancel_hours: establishment?.settings?.min_cancel_hours || 2,
    delay_tolerance: establishment?.settings?.delay_tolerance || 10
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const estRef = doc(db, 'establishments', establishment.id);
      await updateDoc(estRef, {
        'settings.min_cancel_hours': Number(policy.min_cancel_hours),
        'settings.delay_tolerance': Number(policy.delay_tolerance),
        // Mantemos o texto gerado para compatibilidade se necessário, mas o foco são os valores
        politica_cancelamento: `• Cancelamentos devem ser feitos com no mínimo ${policy.min_cancel_hours} horas de antecedência\n• Após ${policy.delay_tolerance} minutos de atraso o horário poderá ser cancelado`
      });
      setSuccess(true);
      if (onSave) onSave();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar política:", error);
      alert("Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center shrink-0">
          <Shield size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">Política de Cancelamento</h3>
          <p className="text-sm text-gray-500">Configure as regras de cancelamento e atrasos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tempo Mínimo de Cancelamento */}
        <div className="bg-white p-6 rounded-[2rem] border-2 border-pink-50 space-y-4">
          <div className="flex items-center gap-3 text-pink-600">
            <Clock size={20} />
            <label className="text-sm font-bold uppercase tracking-wider">Tempo para Cancelamento</label>
          </div>
          <div className="relative">
            <select
              value={policy.min_cancel_hours}
              onChange={(e) => setPolicy({ ...policy, min_cancel_hours: e.target.value })}
              className="w-full p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 appearance-none"
            >
              {[1, 2, 3, 4, 6, 12, 24, 48].map(h => (
                <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pink-400">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            As clientes poderão cancelar o agendamento sem custo até este prazo.
          </p>
        </div>

        {/* Tolerância de Atraso */}
        <div className="bg-white p-6 rounded-[2rem] border-2 border-pink-50 space-y-4">
          <div className="flex items-center gap-3 text-pink-600">
            <AlertTriangle size={20} />
            <label className="text-sm font-bold uppercase tracking-wider">Tolerância de Atraso</label>
          </div>
          <div className="relative">
            <select
              value={policy.delay_tolerance}
              onChange={(e) => setPolicy({ ...policy, delay_tolerance: e.target.value })}
              className="w-full p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 appearance-none"
            >
              {[5, 10, 15, 20, 30].map(m => (
                <option key={m} value={m}>{m} minutos</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pink-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Após este tempo, você poderá marcar como "falta" e liberar o horário.
          </p>
        </div>
      </div>

      {/* Preview para o Cliente */}
      <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white space-y-4">
        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">Visualização do Cliente</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0" />
            <p className="text-sm font-medium text-slate-300">
              Cancelamentos devem ser feitos com no mínimo <span className="text-white font-bold">{policy.min_cancel_hours} horas</span> de antecedência
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0" />
            <p className="text-sm font-medium text-slate-300">
              Após <span className="text-white font-bold">{policy.delay_tolerance} minutos</span> de atraso o horário poderá ser cancelado
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 p-4 bg-slate-950 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
        ) : success ? (
          <CheckCircle2 size={20} />
        ) : (
          <Save size={20} />
        )}
        {success ? 'Configurações Salvas!' : 'Salvar Alterações'}
      </button>
    </div>
  );
}
