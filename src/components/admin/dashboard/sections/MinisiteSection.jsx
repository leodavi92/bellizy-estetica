import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, Store, ChevronRight, Sparkles, Pencil, Lock } from 'lucide-react';
import MiniSiteRenderer from '../../../client/minisite/MiniSiteRenderer';

const MinisiteSection = ({
  showMobilePreview,
  setShowMobilePreview,
  openSection,
  setOpenSection,
  LAYOUTS,
  PALETTES,
  userPlan,
  minisiteSettings,
  setMinisiteSettings,
  showToast,
  setView,
  saveMinisiteSettings,
  loading,
  establishment,
  profileInfo,
  services,
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Visual do seu Site</h2>
        <p className="text-gray-500 font-medium">Personalize a aparência da sua página de agendamento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="lg:hidden space-y-1 mb-4">
            <button
              onClick={() => setShowMobilePreview(true)}
              className="w-full py-4 bg-pink-50 text-pink-600 rounded-[2rem] font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border-2 border-pink-100 hover:bg-pink-100 transition-all active:scale-95"
            >
              <Smartphone size={16} />
              Visualizar Página
            </button>
            <p className="text-[10px] text-center font-bold text-pink-400 italic">
              Visualize as alterações em tempo real antes de salvar
            </p>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === 'layout' ? null : 'layout')}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
                  <Store size={20} />
                </div>
                <h3 className="font-bold text-gray-800">Escolha da Página</h3>
              </div>
              <ChevronRight
                size={20}
                className={`text-gray-400 transition-transform ${openSection === 'layout' ? 'rotate-90' : ''}`}
              />
            </button>

            <AnimatePresence>
              {openSection === 'layout' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-6 pt-0 grid grid-cols-1 gap-3">
                    {Object.values(LAYOUTS).map(layout => {
                      const isRestricted =
                        (layout.plan === 'silver' && userPlan === 'bronze') ||
                        (layout.plan === 'gold' && (userPlan === 'bronze' || userPlan === 'silver'));

                      return (
                        <button
                          key={layout.id}
                          onClick={() => {
                            if (isRestricted) {
                              showToast(
                                `O layout ${layout.name} requer o plano ${
                                  layout.plan === 'gold' ? 'Premium VIP' : 'Profissional'
                                }!`,
                                'error'
                              );
                              setView('assinatura');
                              return;
                            }
                            setMinisiteSettings({ ...minisiteSettings, layoutId: layout.id });
                          }}
                          className={`flex items-start justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                            minisiteSettings.layoutId === layout.id
                              ? 'border-pink-600 bg-pink-50/30'
                              : 'border-gray-100 hover:border-pink-200 bg-white'
                          } ${isRestricted ? 'opacity-75 bg-gray-50/50' : ''}`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                minisiteSettings.layoutId === layout.id ? 'border-pink-600' : 'border-gray-300'
                              }`}
                            >
                              {minisiteSettings.layoutId === layout.id && (
                                <div className="w-2.5 h-2.5 bg-pink-600 rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 flex items-center gap-2">
                                {layout.name}
                                {isRestricted && <Lock size={12} className="text-pink-500" />}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">{layout.description}</p>
                            </div>
                          </div>
                          {isRestricted && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-pink-50 text-pink-600 px-2 py-1 rounded-md border border-pink-100">
                              Bloqueado
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === 'colors' ? null : 'colors')}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-bold text-gray-800">Cores e Estilo</h3>
              </div>
              <ChevronRight
                size={20}
                className={`text-gray-400 transition-transform ${openSection === 'colors' ? 'rotate-90' : ''}`}
              />
            </button>

            <AnimatePresence>
              {openSection === 'colors' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-6 pt-0 grid grid-cols-2 gap-3">
                    {Object.values(PALETTES).map(palette => (
                      <button
                        key={palette.id}
                        onClick={() => {
                          setMinisiteSettings({ ...minisiteSettings, paletteId: palette.id });
                        }}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                          minisiteSettings.paletteId === palette.id
                            ? 'border-pink-600 bg-pink-50/30'
                            : 'border-gray-100 hover:border-pink-200 bg-white'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg ${palette.primary} ${
                            palette.gradient && `bg-gradient-to-br ${palette.gradient}`
                          } shrink-0`}
                        />
                        <span className="text-xs font-bold text-gray-700">{palette.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-pink-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === 'texts' ? null : 'texts')}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-pink-50/20 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Pencil size={20} />
                </div>
                <h3 className="font-bold text-gray-800">Textos do Site</h3>
              </div>
              <ChevronRight
                size={20}
                className={`text-gray-400 transition-transform ${openSection === 'texts' ? 'rotate-90' : ''}`}
              />
            </button>

            <AnimatePresence>
              {openSection === 'texts' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-6 pt-0 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-2">
                        Bio / Descrição Principal
                      </label>
                      <textarea
                        rows={2}
                        value={minisiteSettings.bioText}
                        onChange={e =>
                          setMinisiteSettings({ ...minisiteSettings, bioText: e.target.value })
                        }
                        className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 transition-all font-medium text-gray-700 text-sm resize-none"
                        placeholder="Ex: Realçando sua beleza natural ✨"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Exibir Descrição</p>
                        <p className="text-xs text-gray-500">Mostra o texto de bio/descrição no seu site.</p>
                      </div>
                      <button
                        onClick={() =>
                          setMinisiteSettings({
                            ...minisiteSettings,
                            showDescription: !minisiteSettings.showDescription,
                          })
                        }
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          minisiteSettings.showDescription ? 'bg-pink-600' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            minisiteSettings.showDescription ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={saveMinisiteSettings}
            disabled={loading}
            className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div className="sticky top-10 h-fit space-y-4 hidden lg:block">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4">Prévia do Layout</p>
          <div className="aspect-[9/19] w-full max-w-[320px] mx-auto bg-white rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden relative flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <MiniSiteRenderer
                establishment={{
                  ...establishment,
                  ...profileInfo,
                }}
                onBookClick={() => {}}
                settings={minisiteSettings}
                services={services}
              />
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-slate-950/20 rounded-full z-20" />
          </div>
          <p className="text-center text-[10px] font-bold text-gray-400 italic">Visualização em tempo real</p>
        </div>
      </div>
    </div>
  );
};

export default MinisiteSection;
