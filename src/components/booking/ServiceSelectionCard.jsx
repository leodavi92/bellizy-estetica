import { Check, Clock3, CreditCard } from 'lucide-react';

export default function ServiceSelectionCard({ service, isSelected, onSelect }) {
  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  return (
    <div
      onClick={() => onSelect(service)}
      className={`group relative flex cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        isSelected
          ? 'border-pink-600 bg-pink-50/40 shadow-md shadow-pink-100'
          : 'border-slate-950 bg-white hover:border-pink-200 hover:shadow-lg hover:shadow-slate-100'
      }`}
    >
      {/* Selection indicator background */}
      <div className={`absolute inset-y-0 left-0 w-1 transition-all duration-300 ${
        isSelected ? 'bg-pink-600' : 'bg-transparent'
      }`} />

      <div className="flex w-full items-center gap-4 p-5">
        {/* Custom Checkbox */}
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
          isSelected 
            ? 'border-pink-600 bg-pink-600 text-white' 
            : 'border-slate-950 bg-white group-hover:border-pink-300'
        }`}>
          {isSelected && <Check size={14} strokeWidth={3} />}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-base font-bold transition-colors ${
              isSelected ? 'text-pink-900' : 'text-slate-900'
            }`}>
              {service.nome}
            </h3>
            <span className="text-base font-black text-slate-900">
              {formatPrice(service.preco)}
            </span>
          </div>
          
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
            {service.descricao || 'Atendimento realizado com técnica e cuidado profissional.'}
          </p>

          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Clock3 size={14} className={isSelected ? 'text-pink-500' : 'text-slate-400'} />
              <span>{service.duracao} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Badge for selected state */}
      {isSelected && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-pink-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Selecionado
        </div>
      )}
    </div>
  );
}
