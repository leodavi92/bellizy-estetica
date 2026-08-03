import React from 'react';
import { Plus, Lock, Users, Pencil, ExternalLink, Trash2, Camera } from 'lucide-react';
import ProfessionalAvatar from '../ProfessionalAvatar';

const EquipeSection = ({
  hasAccess,
  userPlan,
  PLANS,
  team,
  profileInfo,
  user,
  showToast,
  setView,
  setEditingMemberId,
  setNewMember,
  setIsTeamModalOpen,
  handleUploadProfessionalPhoto,
  professionalPhotoUploading,
  handleEditTeamMember,
  handleDeleteTeamMember,
}) => {
  if (!hasAccess('multiprofissional')) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-pink-100">
        <div className="w-20 h-20 mb-4 rounded-full bg-pink-50 text-pink-200 flex items-center justify-center">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">Funcionalidade Premium</h3>
        <p className="text-gray-500 font-medium max-w-sm">
          A gestão completa de equipe está disponível apenas para planos profissionais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Minha Equipe</h2>
          <p className="text-gray-500 font-medium">
            Adicione e gerencie os profissionais da sua estética.
          </p>
        </div>
        <button
          onClick={() => {
            const teamLimit = userPlan === 'bronze' ? 1 : userPlan === 'silver' ? 3 : 7;
            const currentTeamCount = team.length + 1;

            if (!hasAccess('equipe')) {
              showToast(
                `Seu plano ${PLANS.find(p => p.id === userPlan)?.name} atingiu o limite de ${teamLimit} membros!`,
                'error'
              );
              setView('assinatura');
              return;
            }

            setEditingMemberId(null);
            setNewMember({ nome: '', cargo: '', foto: '', servicos: [], email: '', password: '' });
            setIsTeamModalOpen(true);
          }}
          className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
            !hasAccess('equipe')
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              : 'bg-slate-950 text-white hover:bg-slate-800 shadow-slate-100'
          }`}
        >
          {!hasAccess('equipe') ? <Lock size={14} /> : <Plus size={16} />}
          Adicionar Profissional
        </button>
      </div>

      {team.length === 0 ? (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
            <Users size={40} />
          </div>
          <p className="text-gray-400 font-medium">
            Você é o único profissional cadastrado no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-pink-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
              <div className="relative group/photo shrink-0">
                <ProfessionalAvatar
                  foto={profileInfo.photoURL || profileInfo.logo_url}
                  nome={profileInfo.nome}
                />
                {user?.tipo === 'admin' && (
                  <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/photo:opacity-100 transition-all flex items-center justify-center cursor-pointer rounded-2xl">
                    <Camera size={20} />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={e => handleUploadProfessionalPhoto(e.target.files[0], 'owner')}
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-gray-900 truncate">{profileInfo.nome}</h4>
                <p className="text-xs text-pink-600 font-black uppercase tracking-widest">
                  Dona / Admin
                </p>
              </div>
            </div>
          </div>

          {team.map(member => (
            <div
              key={member.id}
              className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-pink-200 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="relative group/photo shrink-0">
                  <ProfessionalAvatar
                    foto={member.foto}
                    nome={member.nome}
                    isUploading={professionalPhotoUploading === member.id}
                  />
                  {user?.tipo === 'admin' && (
                    <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/photo:opacity-100 transition-all flex items-center justify-center cursor-pointer rounded-2xl">
                      <Camera size={20} />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={e => handleUploadProfessionalPhoto(e.target.files[0], member.id)}
                      />
                    </label>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-gray-800 truncate">{member.nome}</h4>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                    {member.cargo}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {user?.tipo === 'admin' && (
                    <button
                      onClick={() => handleEditTeamMember(member)}
                      className="p-2 text-gray-300 hover:text-pink-600 transition-colors"
                      title="Editar Profissional"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const message = `Olá ${member.nome}! ✨ Seu acesso profissional no Musa Agenda está pronto.\n\n📧 Login: ${member.email}\n\nAcesse em: ${window.location.origin}/login\n\n(Caso não receba a senha, use "Esqueci minha senha" no login para criar uma nova.)`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="p-2 text-gray-300 hover:text-emerald-500 transition-colors"
                    title="Enviar Acesso via WhatsApp"
                  >
                    <ExternalLink size={18} />
                  </button>
                  {user?.tipo === 'admin' && (
                    <button
                      onClick={() => handleDeleteTeamMember(member.id, member.email)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EquipeSection;
