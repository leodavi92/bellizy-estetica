import { ArrowRight, ShoppingBag } from 'lucide-react';

export default function CheckoutFooter({ selectedServices, totals, onContinue }) {
  const formatPrice = (price) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(price || 0));

  if (selectedServices.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:hidden">
      <div className="mx-auto max-w-md overflow-hidden rounded-[2rem] bg-slate-950 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.4)] ring-1 ring-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <ShoppingBag size={20} className="text-pink-400" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-600 text-[10px] font-bold">
                {selectedServices.length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                Total estimado
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-white">{formatPrice(totals.price)}</span>
                <span className="text-[10px] text-white/40">{totals.duration} min</span>
              </div>
            </div>
          </div>

          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-xl bg-pink-600 px-6 py-3 font-bold transition-all active:scale-95"
          >
            <span>Continuar</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
