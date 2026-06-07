import React, { useState, useEffect } from 'react';
import { format, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Sparkles, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const UpcomingAppointmentCard = ({ appointment, onClick }) => {
  if (!appointment) return null;

  const appDate = appointment.data_hora?.toDate ? appointment.data_hora.toDate() : new Date(appointment.data_hora);
  const isToday = format(appDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isTomorrow = format(appDate, 'yyyy-MM-dd') === format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  let dayText = format(appDate, "dd 'de' MMMM", { locale: ptBR });
  if (isToday) dayText = 'Hoje';
  if (isTomorrow) dayText = 'Amanhã';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white p-6 rounded-[2.5rem] border border-pink-100 shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
    >
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-pink-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 overflow-hidden">
              {appointment.user_avatar ? (
                <img src={appointment.user_avatar} alt={appointment.user_nome} className="w-full h-full object-cover" />
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-lg group-hover:text-pink-600 transition-colors">
                {appointment.user_nome}
              </h4>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Sparkles size={12} className="text-pink-400" /> 
                  {appointment.service_nome || (appointment.services && appointment.services.map(s => s.nome).join(' + '))}
                </p>
                {appointment.professional_nome && (
                  <>
                    <span className="text-gray-300 text-xs">•</span>
                    <p className="text-[10px] font-black text-pink-600 uppercase tracking-tighter bg-pink-50 px-2 py-0.5 rounded-md">
                      {appointment.professional_nome}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="bg-pink-50 text-pink-600 p-2 rounded-xl group-hover:bg-pink-600 group-hover:text-white transition-all">
            <ChevronRight size={20} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-6">
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-pink-600 shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Horário do Atendimento</p>
              <p className="text-sm font-bold text-gray-800">
                {dayText} às {format(appDate, "HH:mm")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UpcomingAppointmentCard;
