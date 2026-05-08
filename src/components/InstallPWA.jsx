import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-pink-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-bounce">
      <div className="flex items-center gap-3">
        <Download size={24} />
        <div>
          <p className="font-bold">Instalar App</p>
          <p className="text-xs opacity-90">Acesse mais rápido pelo celular</p>
        </div>
      </div>
      <button 
        onClick={handleInstall}
        className="bg-white text-pink-600 px-4 py-2 rounded-xl font-bold text-sm"
      >
        Instalar
      </button>
    </div>
  );
}
