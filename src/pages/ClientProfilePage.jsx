import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  User,
  Phone,
  Instagram,
  Save,
  CheckCircle2,
  Info,
  Sparkles,
  ShieldCheck,
  Camera
} from 'lucide-react';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { maskPhone, validatePhone } from '../utils/formatters';

const AVATARS = [
  { id: 'avatar_01', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Eden&backgroundColor=ffdfbf', label: 'Elegante', bgColor: 'bg-orange-50' },
  { id: 'avatar_02', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Aria&backgroundColor=c0aede', label: 'Charmosa', bgColor: 'bg-purple-50' },
  { id: 'avatar_03', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Bella&backgroundColor=b6e3f4', label: 'Delicada', bgColor: 'bg-blue-50' },
  { id: 'avatar_04', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Chloe&backgroundColor=d1d4f9', label: 'Moderna', bgColor: 'bg-slate-50' },
  { id: 'avatar_05', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Daisy&backgroundColor=ffd5dc', label: 'Estilosa', bgColor: 'bg-pink-50' },
  { id: 'avatar_06', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Elena&backgroundColor=ffecb3', label: 'Poderosa', bgColor: 'bg-amber-50' },
  { id: 'avatar_07', url: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Fiona&backgroundColor=ffcdd2', label: 'Linda', bgColor: 'bg-rose-50' }
];

export default function ClientProfilePage() {
  const { user, setUser } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    instagram: '',
    observacoes: '',
    photoURL: '',
    avatar_id: ''
  });
  
  const [saving, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        nome: user.nome || '',
        telefone: user.telefone || '',
        instagram: user.instagram || '',
        observacoes: user.observacoes || '',
        photoURL: user.photoURL || AVATARS[0].url,
        avatar_id: user.avatar_id || AVATARS[0].id
      });
    }
  }, [user]);

  const handleAvatarSelect = async (avatar) => {
    setFormData(prev => ({ 
      ...prev, 
      photoURL: avatar.url,
      avatar_id: avatar.id
    }));

    if (user?.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { 
          photoURL: avatar.url,
          avatar_id: avatar.id 
        });
        if (setUser) {
          setUser(prev => ({ ...prev, photoURL: avatar.url, avatar_id: avatar.id }));
        }
      } catch (error) {
        console.error('Erro ao salvar avatar automaticamente:', error);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    if (!validatePhone(formData.telefone)) {
      alert('Por favor, insira um WhatsApp válido com DDD.');
      return;
    }

    try {
      setLoading(true);
      const userRef = doc(db, 'users', user.uid);      await updateDoc(userRef, formData);
      
      if (setUser) {
        setUser(prev => ({ ...prev, ...formData }));
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar informações.');
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = AVATARS.find(a => a.id === formData.avatar_id) || AVATARS[0];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-32 pt-6">
      {/* Profile Preview Card */}
      <section className="relative overflow-hidden rounded-[3rem] border-2 border-slate-950 bg-white p-8 shadow-2xl shadow-slate-200 sm:p-10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-pink-50 blur-3xl" />
        
        <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:text-left">
          <div className="relative h-32 w-32 shrink-0">
            <div className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[2.5rem] border-2 border-slate-950 ${currentAvatar.bgColor} shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105`}>
              <img 
                src={formData.photoURL} 
                alt="Avatar Preview" 
                className="h-full w-full object-cover p-2"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${formData.nome || 'P'}&background=random`;
                }}
              />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg ring-4 ring-white">
              <Sparkles size={18} className="text-pink-400" />
            </div>
          </div>
          
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white w-fit mx-auto sm:mx-0">
              <User size={12} className="text-pink-400" />
              <span>Perfil Premium</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {formData.nome || 'Sua Identidade'}
            </h1>
            <p className="text-sm font-bold leading-relaxed text-slate-500 max-w-sm">
              Sua conta na estetica Patrícia. Personalize seu perfil com avatares exclusivos.
            </p>
          </div>
        </div>
      </section>

      {/* Avatar Picker Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Escolha seu Avatar</h2>
            <p className="text-xs font-bold text-slate-400">Coleção de Mulheres Charmosas</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">
            {AVATARS.length} Opções
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 sm:grid-cols-7">
          {AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => handleAvatarSelect(avatar)}
              className={`relative aspect-square flex items-center justify-center rounded-3xl border-2 transition-all hover:-translate-y-1 active:scale-95 ${
                formData.avatar_id === avatar.id 
                  ? `border-slate-950 ${avatar.bgColor} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ring-4 ring-pink-100` 
                  : `border-slate-200 ${avatar.bgColor} hover:border-slate-400`
              }`}
            >
              <img 
                src={avatar.url} 
                alt={avatar.label} 
                className="h-full w-full object-cover p-1" 
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${avatar.label}&background=random`;
                }}
              />
              {formData.avatar_id === avatar.id && (
                <div className="absolute -top-2 -right-2">
                  <div className="rounded-full bg-slate-950 p-1.5 text-white shadow-sm ring-2 ring-white">
                    <CheckCircle2 size={10} strokeWidth={4} />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Form Section */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-[2.5rem] border-2 border-slate-950 bg-white p-8 shadow-xl shadow-slate-200 space-y-8">
          
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
              <div className="h-8 w-8 rounded-xl bg-slate-950 flex items-center justify-center text-white">
                <Info size={16} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Dados de Contato</h3>
            </div>

            <div className="grid gap-6">
              {/* Nome */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/30 px-5 py-4 text-sm font-bold text-slate-900 transition-all focus:border-slate-950 focus:bg-white focus:outline-none"
                  placeholder="Seu nome completo"
                />
              </div>

              {/* Contatos Grid */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    WhatsApp
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-950">
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      required
                      value={formData.telefone}
                      onChange={e => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/30 pl-12 pr-5 py-4 text-sm font-bold text-slate-900 transition-all focus:border-slate-950 focus:bg-white focus:outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Instagram
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-950">
                      <Instagram size={18} />
                    </div>
                    <input
                      type="text"
                      value={formData.instagram}
                      onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/30 pl-12 pr-5 py-4 text-sm font-bold text-slate-900 transition-all focus:border-slate-950 focus:bg-white focus:outline-none"
                      placeholder="@seuusuario"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Observações de Atendimento
                </label>
                <textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/30 px-5 py-4 text-sm font-bold text-slate-900 transition-all focus:border-slate-950 focus:bg-white focus:outline-none resize-none"
                  placeholder="Alguma alergia ou preferência específica?"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className={`w-full relative group overflow-hidden rounded-2xl border-2 border-slate-950 bg-slate-950 py-4 font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-slate-950 active:scale-95 disabled:opacity-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]`}
            >
              <div className="flex items-center justify-center gap-3">
                {saving ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : success ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Perfil Atualizado!</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </form>

      {/* Footer Info */}
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="h-px w-full bg-slate-100" />
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
          <ShieldCheck size={14} />
          <span>Seus dados estão protegidos</span>
        </div>
      </div>
    </div>
  );
}
