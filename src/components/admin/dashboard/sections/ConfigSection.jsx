import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  Link as LinkIcon,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Store,
  MapPin,
  Phone,
  Instagram,
  Shield,
  Lock,
  LogOut,
} from 'lucide-react';
import CancellationPolicySettings from '../../settings/CancellationPolicySettings';

export default function ConfigSection({
  user,
  team,
  openConfigSection,
  setOpenConfigSection,
  publicLink,
  handleCopyLink,
  tempSlug,
  setTempSlug,
  sanitizeSlug,
  slugStatus,
  isSlugDirty,
  slugSaving,
  slugSaved,
  handleSaveSlug,
  saveSettings,
  profileInfo,
  setProfileInfo,
  handleUploadLogo,
  logoUploading,
  isPolicyOpen,
  setIsPolicyOpen,
  establishment,
  handleUpdatePassword,
  passwordData,
  setPasswordData,
  isUpdatingPassword,
  DESCRIPTION_LIMIT,
  maskPhone,
  showToast,
  db,
  deleteDoc,
  updateDoc,
  doc,
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-4">
      
      {/* Perfil do Profissional (Identificação) */}
      {user?.tipo === 'staff' && (
        <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[2rem] overflow-hidden bg-pink-50 border-2 border-pink-100 shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-pink-600 font-black text-3xl">
                  {user?.nome?.charAt(0) || 'P'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">Painel do Profissional</p>
              <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase truncate">{user?.nome}</h3>
              {user?.professional_id && (
                <div className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-100 mt-2">
                  <Sparkles size={12} className="mr-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {team.find(p => p.id === user.professional_id)?.cargo || 'Especialista'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {user?.tipo === 'admin' && (
        <>
          {/* Link da Estética */}
          <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenConfigSection(openConfigSection === 'link' ? null : 'link')}
              className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <LinkIcon size={20} sm:size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Seu Link Único</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Endereço para agendamentos das clientes.</p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'link' ? 'rotate-90' : ''}`}>
                <ChevronRight size={18} />
              </div>
            </button>

            <AnimatePresence>
              {openConfigSection === 'link' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-6 pb-8 sm:px-8 space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 px-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-400">{window.location.host}/</p>
                          <p className="text-[11px] text-gray-400 truncate">{publicLink}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="shrink-0 px-3 py-2 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors text-[10px] font-black uppercase tracking-widest border border-pink-100"
                        >
                          Copiar
                        </button>
                      </div>

                      <div className="relative group">
                        <input 
                          type="text"
                          required
                          value={tempSlug}
                          onChange={e => {
                            const raw = e.target.value || '';
                            const lastPart = raw.includes('/') ? raw.split('/').filter(Boolean).pop() || '' : raw;
                            setTempSlug(sanitizeSlug(lastPart));
                          }}
                          className={`w-full pl-4 pr-12 py-3 sm:py-4 bg-pink-50/50 border-2 rounded-2xl outline-none transition-all font-bold text-gray-700 text-sm sm:text-base ${
                            slugStatus.checking 
                              ? 'border-gray-200' 
                              : !slugStatus.available
                                ? 'border-red-300 focus:border-red-400'
                                : isSlugDirty
                                  ? 'border-rose-300 focus:border-rose-400'
                                  : 'border-transparent focus:border-pink-300'
                          }`}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          {slugSaving ? (
                            <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                          ) : slugStatus.checking ? (
                            <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                          ) : !isSlugDirty || slugSaved ? (
                            <CheckCircle className="text-green-500" size={20} />
                          ) : (
                            <AlertCircle className="text-rose-500" size={20} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-2">
                        <p className="text-[11px] text-gray-400">Dica: use um nome curto e fácil de lembrar.</p>
                        <button
                          type="button"
                          onClick={handleSaveSlug}
                          disabled={slugSaving || slugStatus.checking || !slugStatus.available || !isSlugDirty}
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
                            slugSaved || !isSlugDirty
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {slugSaving ? 'Salvando...' : slugSaved || !isSlugDirty ? 'Salvo' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Identidade do Salão */}
          <form onSubmit={saveSettings} className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenConfigSection(openConfigSection === 'visual' ? null : 'visual')}
              className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <Store size={20} sm:size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Identidade do Salão</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Logo, endereço, contato e descrição da estética.</p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'visual' ? 'rotate-90' : ''}`}>
                <ChevronRight size={18} />
              </div>
            </button>

            <AnimatePresence>
              {openConfigSection === 'visual' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-6 pb-8 sm:px-8 space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Logo da Estética</label>
                        <div className="bg-pink-50/50 border-2 border-transparent rounded-[2rem] p-4 sm:p-5">
                          <label htmlFor="logo-upload" className="w-full flex items-center justify-center cursor-pointer">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-pink-100 overflow-hidden flex items-center justify-center shrink-0 relative">
                              {profileInfo.logo_url ? (
                                <img src={profileInfo.logo_url} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-3xl sm:text-4xl font-black text-pink-400">+</span>
                              )}
                              {logoUploading && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                  <div className="w-6 h-6 border-2 border-pink-200 border-t-pink-600 rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                          </label>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLogo(file);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nome da Estética</label>
                        <div className="relative">
                          <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                          <input 
                            type="text"
                            required
                            value={profileInfo.nome}
                            onChange={e => setProfileInfo({...profileInfo, nome: e.target.value})}
                            className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                            placeholder="Nome do seu estabelecimento"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Endereço Completo</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                          <input 
                            type="text"
                            required
                            value={profileInfo.endereco}
                            onChange={e => setProfileInfo({...profileInfo, endereco: e.target.value})}
                            className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                            placeholder="Rua, número, bairro e cidade"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">WhatsApp / Contato</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                          <input 
                            type="tel"
                            required
                            value={profileInfo.telefone}
                            onChange={e => setProfileInfo({...profileInfo, telefone: maskPhone(e.target.value)})}
                            className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-2">Instagram (@perfil)</label>
                        <div className="relative">
                          <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400" size={18} />
                          <input
                            type="text"
                            value={profileInfo.instagram}
                            onChange={e => setProfileInfo({ ...profileInfo, instagram: e.target.value.replace(/\s+/g, '') })}
                            className="w-full pl-12 pr-4 py-3 sm:py-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-bold text-gray-700 text-sm sm:text-base"
                            placeholder="@seu.instagram"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-400 uppercase ml-2">Descrição da Estética</label>
                          <span className="text-[10px] font-bold text-gray-400">
                            {profileInfo.descricao.length}/{DESCRIPTION_LIMIT}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={DESCRIPTION_LIMIT}
                          value={profileInfo.descricao}
                          onChange={e => setProfileInfo({...profileInfo, descricao: e.target.value})}
                          className="w-full p-3 sm:p-4 bg-pink-50/50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-medium text-gray-700 text-sm sm:text-base resize-none"
                          placeholder="Conte um pouco sobre os seus diferenciais..."
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 shadow-lg transition-all">
                      Salvar Identidade
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Política de Cancelamento */}
          <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPolicyOpen(v => !v)}
              className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <Shield size={20} sm:size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Política de Cancelamento</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Regras de cancelamento e atraso.</p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${isPolicyOpen ? 'rotate-90' : ''}`}>
                <ChevronRight size={18} />
              </div>
            </button>

            <AnimatePresence>
              {isPolicyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-6 pb-8 sm:px-8">
                    <CancellationPolicySettings establishment={establishment} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Segurança (Troca de Senha) - Para Todos */}
      <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenConfigSection(openConfigSection === 'security' ? null : 'security')}
          className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-pink-50/20 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
              <Lock size={20} sm:size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Segurança</h3>
              <p className="text-xs sm:text-sm text-gray-500">Altere sua senha de acesso.</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center transition-transform ${openConfigSection === 'security' ? 'rotate-90' : ''}`}>
            <ChevronRight size={18} />
          </div>
        </button>

        <AnimatePresence>
          {openConfigSection === 'security' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleUpdatePassword} className="px-6 pb-8 sm:px-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2">Senha Atual</label>
                  <input 
                    type="password"
                    required
                    value={passwordData.currentPassword}
                    onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Sua senha atual"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2">Nova Senha</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.newPassword}
                    onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2">Confirmar Nova Senha</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-indigo-300 transition-all font-bold text-gray-700 text-sm"
                    placeholder="Repita a nova senha"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isUpdatingPassword}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zona de Perigo para Staff */}
      {user?.tipo === 'staff' && (
        <div className="bg-rose-50 p-6 rounded-[2.5rem] border-2 border-dashed border-rose-200">
          <h4 className="text-rose-800 font-black text-lg uppercase tracking-tight mb-2">Sair da Equipe</h4>
          <p className="text-rose-600 text-sm font-medium mb-4">
            Ao sair, você perderá acesso imediato a este painel. Esta ação não pode ser desfeita.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Tem certeza que deseja sair desta equipe?")) return;
              try {
                if (user.professional_id) await deleteDoc(doc(db, "professionals", user.professional_id));
                await updateDoc(doc(db, "users", user.uid), { tipo: 'cliente', establishment_id: null, professional_id: null });
                window.location.reload();
              } catch (error) {
                showToast("Erro ao sair da equipe.", "error");
              }
            }}
            className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Sair da Equipe Agora
          </button>
        </div>
      )}
    </div>
  );
}
