import React, { useState } from 'react';
import { Store, Phone, ArrowRight, Sparkles } from 'lucide-react';
import { db } from '../../../services/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { generateUniqueSlug } from '../../../services/establishmentService';
import { maskPhone, validatePhone } from '../../../utils/formatters';
export default function BusinessInfoStep({ establishment, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: establishment?.telefone || ''
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.telefone.trim()) {
      return alert("Por favor, preencha o nome da estética e o WhatsApp.");
    }

    if (!validatePhone(formData.telefone)) {
      return alert("Por favor, insira um WhatsApp válido com DDD.");
    }
    setLoading(true);
    try {
      const uniqueSlug = await generateUniqueSlug(formData.nome);
      const estRef = doc(db, 'establishments', establishment.id);
      await updateDoc(estRef, {
        nome: formData.nome,
        name: formData.nome,
        slug: uniqueSlug,
        telefone: formData.telefone,
        phone: formData.telefone,
        'setup_steps.info_basica': true,
        last_write_ts: Timestamp.now()
      });
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Erro ao salvar informações básicas:", error);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-8 py-6 px-4">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-pink-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-pink-200 sm:w-20 sm:h-20"
        >
          <Sparkles size={32} className="sm:w-10 sm:h-10" />
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-black text-gray-900 tracking-tight sm:text-3xl">Boas-vindas!</h1>
          <p className="text-sm text-gray-500 font-medium sm:text-base max-w-xs mx-auto">
            Defina o nome da sua estética e seu WhatsApp para liberar o painel.
          </p>
        </motion.div>
      </div>

      <motion.form 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleSave} 
        className="space-y-6"
      >
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2 sm:text-xs">Nome da Estética</label>
          <div className="relative group">
            <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400 group-focus-within:text-pink-600 transition-colors" size={18} />
            <input
              type="text"
              required
              placeholder="Ex: Studio Bella"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full pl-11 pr-4 py-4 bg-pink-50/30 border-2 border-pink-50 rounded-2xl outline-none focus:border-pink-300 focus:bg-white transition-all font-bold text-gray-800 text-sm sm:text-base sm:py-5"
            />
          </div>
          <p className="text-[10px] text-gray-400 font-medium ml-2">Esse nome vai aparecer para suas clientes.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-pink-600 ml-2 sm:text-xs">WhatsApp de Contato</label>
          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400 group-focus-within:text-pink-600 transition-colors" size={18} />
            <input
              type="tel"
              required
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
              className="w-full pl-11 pr-4 py-4 bg-pink-50/30 border-2 border-pink-50 rounded-2xl outline-none focus:border-pink-300 focus:bg-white transition-all font-bold text-gray-800 text-sm sm:text-base sm:py-5"
            />
          </div>
          <p className="text-[10px] text-gray-400 font-medium ml-2">Este número será usado pelas suas clientes.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 p-4 bg-slate-950 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-slate-200 text-sm sm:text-base sm:p-5"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
          ) : (
            <>
              <span>Continuar</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </motion.form>
    </div>
  );
}
