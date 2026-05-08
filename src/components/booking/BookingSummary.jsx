import { Clock3, CreditCard, ArrowRight, X } from 'lucide-react';

export default function BookingSummary({ selectedServices, totals, onContinue, onRemove }) {
  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  return (
    <div className="sticky top-6 flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Seu Agendamento</h3>
        <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">
          {selectedServices.length} {selectedServices.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {selectedServices.map((service) => (
          <div 
            key={service.id} 
            className="group flex items-center justify-between gap-3 rounded-xl border border-slate-50 bg-slate-50/50 p-3 transition-all hover:border-pink-100 hover:bg-pink-50/30"
          >
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">{service.nome}</span>
              <span className="text-[10px] font-medium text-slate-400">{service.duracao} min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{formatPrice(service.preco)}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(service);
                }}
                className="rounded-lg p-1 text-slate-300 hover:bg-white hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock3 size={16} />
            <span>Tempo total estimado</span>
          </div>
          <span className="text-slate-900">{totals.duration} min</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500">
            <CreditCard size={16} />
            <span className="text-sm font-medium">Total a pagar</span>
          </div>
          <span className="text-2xl font-black text-pink-600">
            {formatPrice(totals.price)}
          </span>
        </div>
      </div>

      <button
        onClick={onContinue}
        disabled={selectedServices.length === 0}
        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-950 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50"
      >
        <span className="relative z-10">Continuar agendamento</span>
        <ArrowRight size={18} className="relative z-10 transition-transform group-hover:translate-x-1" />
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      </button>

      <p className="text-center text-[10px] font-medium text-slate-400">
        Você poderá escolher a data e o horário no próximo passo.
      </p>
    </div>
  );
}
