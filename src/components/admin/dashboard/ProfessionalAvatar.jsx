import React from 'react';
import { Sparkles } from 'lucide-react';

const ProfessionalAvatar = ({ foto, nome, size = 'w-16 h-16', isUploading = false }) => {
  if (isUploading) {
    return (
      <div className={`${size} rounded-2xl bg-pink-50 flex items-center justify-center text-pink-600 shadow-sm border-2 border-white overflow-hidden`}>
        <div className="animate-spin">
          <Sparkles size={24} />
        </div>
      </div>
    );
  }

  if (foto) {
    return (
      <div className={`${size} rounded-2xl shadow-sm border-2 border-white overflow-hidden shrink-0`}>
        <img src={foto} alt={nome} className="w-full h-full object-cover" />
      </div>
    );
  }

  const colors = [
    'bg-pink-100 text-pink-600',
    'bg-purple-100 text-purple-600',
    'bg-blue-100 text-blue-600',
    'bg-indigo-100 text-indigo-600',
    'bg-emerald-100 text-emerald-600',
    'bg-rose-100 text-rose-600',
    'bg-amber-100 text-amber-600',
  ];

  const charCode = (nome || 'M').charCodeAt(0);
  const colorIndex = charCode % colors.length;
  const initials = (nome || 'M')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`${size} rounded-2xl ${colors[colorIndex]} flex items-center justify-center font-black text-xl shadow-sm border-2 border-white shrink-0 tracking-tighter`}>
      {initials}
    </div>
  );
};

export default ProfessionalAvatar;
