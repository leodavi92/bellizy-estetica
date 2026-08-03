import React from 'react';
import AnamnesisManager from '../../settings/AnamnesisManager';

const AnamneseSection = ({ establishment, user, allAppointments }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AnamnesisManager
        establishment={establishment}
        user={user}
        allAppointments={allAppointments}
      />
    </div>
  );
};

export default AnamneseSection;
