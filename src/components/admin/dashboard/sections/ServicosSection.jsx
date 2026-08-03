import React from 'react';
import { Plus, Sparkles, Clock, Pencil, Trash2 } from 'lucide-react';

const ServicosSection = ({
  services,
  user,
  setEditingServiceId,
  setNewService,
  setIsServiceModalOpen,
  handleEditService,
  handleDeleteService,
}) => {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Serviços</h2>
          <p className="text-gray-500 font-medium">
            Gerencie o catálogo de serviços oferecidos ({services.length}).
          </p>
        </div>

        {user?.tipo === 'admin' && (
          <button
            onClick={() => {
              setEditingServiceId(null);
              setNewService({ nome: '', descricao: '', duracao: 30, preco: '' });
              setIsServiceModalOpen(true);
            }}
            className="bg-slate-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100"
          >
            <Plus size={16} strokeWidth={3} />
            Novo Serviço
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {services.length === 0 ? (
          <div className="sm:col-span-2 bg-white p-10 rounded-[2.5rem] border-2 border-dashed border-pink-100 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-pink-50 text-pink-200 rounded-full flex items-center justify-center mb-4">
              <Sparkles size={40} />
            </div>
            <p className="text-gray-400 font-medium">Nenhum serviço cadastrado.</p>
            {user?.tipo === 'admin' && (
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="mt-4 text-pink-600 font-bold text-sm hover:underline"
              >
                Cadastrar seu primeiro serviço
              </button>
            )}
          </div>
        ) : (
          services.map(s => (
            <div
              key={s.id}
              className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-pink-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all"
            >
              <div>
                <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-800 text-base sm:text-lg">{s.nome}</h4>
                  {s.prioridade === 1 && (
                    <span className="px-2 py-0.5 bg-pink-100 text-pink-600 text-[8px] font-black uppercase tracking-widest rounded-md">
                      Prioridade
                    </span>
                  )}
                </div>
                {s.descricao && (
                  <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-5 max-w-[240px]">
                    {s.descricao}
                  </p>
                )}
                <p className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-2 mt-1">
                  <Clock size={14} className="text-pink-400" /> {s.duracao} min
                  <span className="w-1 h-1 bg-pink-200 rounded-full"></span>
                  <span className="text-pink-600 font-bold">R$ {s.preco}</span>
                </p>
              </div>
              {user?.tipo === 'admin' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditService(s)}
                    className="p-2 sm:p-3 text-gray-300 hover:text-pink-600 hover:bg-pink-50 rounded-2xl transition-all"
                    title="Editar serviço"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteService(s.id)}
                    className="p-2 sm:p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ServicosSection;
