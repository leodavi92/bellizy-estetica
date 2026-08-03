import React from 'react';
import ReminderManager from '../ReminderManager';

const LembretesSection = ({ establishment, allAppointments }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ReminderManager
        establishment={establishment}
        allAppointments={allAppointments}
      />
    </div>
  );
};

export default LembretesSection;
