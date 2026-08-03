import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Check, LinkIcon } from 'lucide-react';
import NextAppointmentSection from '../NextAppointmentSection';

const OverviewSection = ({
  currentSlug,
  handleCopyLink,
  isCopied,
  allAppointments,
  establishment,
  allProfessionals,
  handleUpdateAppointment,
  handleConfirmReschedule,
}) => {
  return (
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
  );
};

export default OverviewSection;
