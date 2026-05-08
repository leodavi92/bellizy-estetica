import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, Calendar } from 'lucide-react';
import UpcomingAppointmentCard from './UpcomingAppointmentCard';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const NextAppointmentSection = ({ appointments }) => {
  const [selectedApp, setSelectedApp] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const upcomingAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];

    const now = new Date();
    
    // Filtra agendamentos futuros e não cancelados
    return appointments
      .filter(app => {
        const appDate = app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora);
        const isValidStatus = app.status === 'ativo' || app.status === 'scheduled' || app.status === 'confirmado';
        return appDate >= now && isValidStatus;
      })
      .sort((a, b) => {
        const dateA = a.data_hora?.toDate ? a.data_hora.toDate() : new Date(a.data_hora);
        const dateB = b.data_hora?.toDate ? b.data_hora.toDate() : new Date(b.data_hora);
        return dateA - dateB;
      });
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0];
  const otherUpcoming = upcomingAppointments.slice(1, 4); // Pega mais 3 próximos

  const handleCancel = async (id) => {
    try {
      const ref = doc(db, "appointments", id);
      await updateDoc(ref, { status: 'cancelled' });
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      alert("Erro ao cancelar agendamento.");
    }
  };

  const handleComplete = async (id) => {
    try {
      const ref = doc(db, "appointments", id);
      await updateDoc(ref, { status: 'completed' });
    } catch (error) {
      console.error("Erro ao finalizar agendamento:", error);
      alert("Erro ao finalizar agendamento.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
          <Clock size={20} className="text-pink-600" /> 
          Próximo da Agenda
        </h3>
        {nextAppointment && (
          <span className="text-[10px] font-black uppercase tracking-widest text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
            Painel Inteligente
          </span>
        )}
      </div>

      {nextAppointment ? (
        <div className="space-y-3">
          <UpcomingAppointmentCard 
            appointment={nextAppointment} 
            onClick={() => {
              setSelectedApp(nextAppointment);
              setIsModalOpen(true);
            }}
          />

          {otherUpcoming.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Próximos em seguida</p>
              {otherUpcoming.map(app => (
                <div 
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center justify-between p-4 bg-white border border-pink-50 rounded-3xl hover:border-pink-200 transition-all cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 overflow-hidden text-xs font-bold">
                      {format(app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora), "HH:mm")}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{app.user_nome}</h4>
                      <p className="text-[10px] text-gray-500 uppercase font-medium truncate max-w-[150px]">
                        {app.service_nome || (app.services && app.services.map(s => s.nome || s.name).join(' + '))}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-pink-400">
                    {format(app.data_hora?.toDate ? app.data_hora.toDate() : new Date(app.data_hora), "dd/MM")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
            <Calendar size={32} />
          </div>
          <p className="text-gray-400 font-medium">Nenhum próximo agendamento encontrado.</p>
          <p className="text-xs text-gray-300 mt-1">Sua agenda está livre por enquanto!</p>
        </div>
      )}

      <AppointmentDetailsModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedApp}
        onCancel={handleCancel}
        onComplete={handleComplete}
      />
    </div>
  );
};

export default NextAppointmentSection;
