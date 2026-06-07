import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Chrome, Mail, Lock, User, ArrowLeft, Sparkles, Store, MapPin, Phone } from 'lucide-react';
import { maskPhone, validatePhone } from '../utils/formatters';

export default function Login() {
  const { user, loginWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, changePassword } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('selection'); // 'selection', 'auth'
  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot', 'change_password'
  const [role, setRole] = useState('cliente'); // 'cliente', 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirecionamento automático se o usuário já estiver logado
  useEffect(() => {
    if (user) {
      // Se o usuário precisa trocar a senha, forçamos o modo change_password
      if (user.requirePasswordChange) {
        setView('auth');
        setMode('change_password');
        return;
      }

      const isAuthRoute = window.location.pathname === '/login' || window.location.pathname === '/';
      
      if (isAuthRoute) {
        if (user.tipo === 'admin' || user.tipo === 'staff') {
          navigate('/admin', { replace: true });
        } else {
          let lastSlug = localStorage.getItem('last_estetica_slug');
          if (lastSlug) {
            lastSlug = lastSlug.replace('estetica/', '');
            navigate(`/${lastSlug}`, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }
      }
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      if (mode === 'login') {
        const loggedUser = await signInWithEmail(cleanEmail, password, role);
        console.log("Login realizado com sucesso:", loggedUser.uid);
      } else if (mode === 'register') {
        if (!validatePhone(telefone)) {
          setError('Por favor, insira um WhatsApp válido com DDD.');
          setLoading(false);
          return;
        }
        const extraData = role === 'admin' ? { telefone, nomeEstetica: nome } : { telefone };
        const newUser = await signUpWithEmail(cleanEmail, password, nome, role, extraData);
        console.log("Cadastro realizado com sucesso:", newUser.uid);
      } else if (mode === 'forgot') {
        await resetPassword(cleanEmail);
        setMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      } else if (mode === 'change_password') {
        if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('A nova senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        await changePassword(password);
        setMessage('Senha atualizada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/admin'), 2000);
      }
    } catch (err) {
      console.error("Erro capturado na tela de login:", err);
      
      if (err.code === 'auth/email-already-in-use') {
        if (role === 'admin') {
          setError('Este e-mail já possui uma conta de cliente. Tente fazer LOGIN como "Dona de Estética" para migrar seu perfil.');
        } else {
          setError('Este e-mail já está em uso. Tente fazer login.');
        }
      }
      else if (err.code === 'auth/user-not-found') setError('Usuário não encontrado. Verifique o e-mail ou cadastre-se.');
      else if (err.code === 'auth/wrong-password') setError('Senha incorreta.');
      else if (err.code === 'auth/invalid-credential') setError('E-mail ou senha incorretos.');
      else if (err.code === 'auth/weak-password') setError('A senha deve ter pelo menos 6 caracteres.');
      else if (err.code === 'auth/too-many-requests') setError('Muitas tentativas. Tente novamente mais tarde.');
      else setError('Ocorreu um erro ao acessar. Verifique seus dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle(role);
    } catch (err) {
      console.error("Erro no login Google:", err);
      setError('Erro ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'selection') {
    return (
      <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] sm:rounded-[3rem] shadow-xl p-6 sm:p-10 border border-pink-100 text-center relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-600 to-rose-500" />
          
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-pink-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 sm:mb-8 shadow-xl shadow-pink-100 rotate-3 transition-transform hover:rotate-0 cursor-default">
            <Sparkles size={48} className="animate-pulse" />
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter bg-gradient-to-r from-pink-600 to-rose-500 bg-clip-text text-transparent italic mb-3" style={{ textShadow: '0 0 1px rgba(219, 39, 119, 0.1)' }}>
            Musa Agenda
          </h1>
          <div className="flex flex-col items-center gap-1 mb-8 sm:mb-10">
            <div className="h-px w-12 bg-pink-200" />
            <p className="text-xs sm:text-sm text-gray-400 font-black uppercase tracking-[0.2em]">Sua beleza em boas mãos</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <button 
              onClick={() => { setRole('cliente'); setView('auth'); }}
              className="group flex items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-white border-2 border-pink-50 rounded-[1.5rem] sm:rounded-[2rem] hover:border-pink-500 transition-all text-left shadow-sm hover:shadow-md active:scale-95"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-all shrink-0">
                <Sparkles size={24} className="sm:w-8 sm:h-8" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Sou Cliente</h3>
                <p className="text-xs sm:text-sm text-gray-400">Quero agendar um serviço</p>
              </div>
            </button>

            <button 
              onClick={() => { setRole('admin'); setView('auth'); }}
              className="group flex items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-white border-2 border-pink-50 rounded-[1.5rem] sm:rounded-[2rem] hover:border-pink-500 transition-all text-left shadow-sm hover:shadow-md active:scale-95"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-pink-100 text-pink-600 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-all shrink-0">
                <Store size={24} className="sm:w-8 sm:h-8" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Dona de Estética</h3>
                <p className="text-xs sm:text-sm text-gray-400">Quero gerenciar meu negócio</p>
              </div>
            </button>
          </div>

          <p className="mt-12 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
            Tecnologia para beleza e bem-estar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 border border-pink-100">
        <button 
          onClick={() => setView('selection')}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-pink-600 hover:underline"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          {mode === 'login' && (role === 'admin' ? 'Acesso Administrativo' : 'Bem-vinda(o)!')}
          {mode === 'register' && (role === 'admin' ? 'Crie seu Espaço' : 'Crie sua conta')}
          {mode === 'forgot' && 'Recuperar senha'}
          {mode === 'change_password' && 'Troca de Senha'}
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          {mode === 'login' && (role === 'admin' ? 'Gerencie sua agenda de qualquer lugar.' : 'Agende sua sessão de forma rápida.')}
          {mode === 'register' && (role === 'admin' ? 'Comece a profissionalizar sua estética hoje.' : 'Comece sua jornada de autocuidado.')}
          {mode === 'change_password' && 'Por segurança, você deve definir uma nova senha no seu primeiro acesso.'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 text-center border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm mb-4 text-center border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'change_password' && (
            <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100 mb-4">
              <p className="text-xs font-bold text-pink-600">
                Olá, {user?.nome}!
              </p>
              <p className="text-[10px] text-pink-400 mt-1 uppercase font-black tracking-widest">
                Esta é uma medida de segurança obrigatória.
              </p>
            </div>
          )}

          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={role === 'admin' ? "Nome da Estética" : "Seu nome completo"}
                required
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 outline-none focus:border-pink-300 transition-all font-bold text-gray-700"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="relative">
              <Phone className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="tel"
                placeholder={role === 'admin' ? 'WhatsApp da Estética' : 'Seu WhatsApp'}
                required
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 outline-none focus:border-pink-300 transition-all font-bold text-gray-700"
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
              />
            </div>
          )}

          {mode !== 'change_password' && (
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="E-mail"
                required
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 outline-none focus:border-pink-300 transition-all font-bold text-gray-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="password"
                placeholder={mode === 'change_password' ? "Nova Senha" : "Senha"}
                required
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 outline-none focus:border-pink-300 transition-all font-bold text-gray-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {mode === 'change_password' && (
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Confirme a Nova Senha"
                required
                className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 outline-none focus:border-pink-300 transition-all font-bold text-gray-700"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 rounded-2xl font-bold hover:bg-pink-700 transition-all active:scale-95 shadow-lg shadow-pink-200 disabled:opacity-50"
          >
            {loading ? 'Processando...' : (
              mode === 'login' ? 'Entrar' : 
              mode === 'register' ? 'Criar Conta' : 
              mode === 'forgot' ? 'Enviar Link' : 'Definir Nova Senha'
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 text-center space-y-2">
            <button 
              onClick={() => setMode('forgot')}
              className="text-sm text-pink-600 font-medium hover:underline block w-full"
            >
              Esqueceu a senha?
            </button>
            <button 
              onClick={() => setMode('register')}
              className="text-sm text-gray-500 font-medium hover:underline block w-full"
            >
              Não tem uma conta? <span className="text-pink-600 font-bold">Cadastre-se</span>
            </button>
          </div>
        )}

        {mode === 'register' && (
          <div className="mt-4 text-center">
            <button 
              onClick={() => setMode('login')}
              className="text-sm text-gray-500 font-medium hover:underline"
            >
              Já tem uma conta? <span className="text-pink-600 font-bold">Entre aqui</span>
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mt-4 text-center">
            <button 
              onClick={() => setMode('login')}
              className="text-sm text-pink-600 font-medium hover:underline"
            >
              Voltar para o login
            </button>
          </div>
        )}

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">Ou continue com</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 py-3 rounded-2xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-pink-200 transition-all active:scale-95 shadow-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-pink-600 animate-spin rounded-full" />
          ) : (
            <>
              <Chrome size={20} className="text-pink-600" />
              <span>Google</span>
            </>
          )}
        </button>

        <div className="mt-8 text-center">
          {mode === 'login' ? (
            <p className="text-sm text-gray-500">
              Não tem uma conta?{' '}
              <button 
                onClick={() => setMode('register')}
                className="text-pink-600 font-bold hover:underline"
              >
                Cadastre-se
              </button>
            </p>
          ) : (
            <button 
              onClick={() => setMode('login')}
              className="flex items-center justify-center gap-2 text-sm text-pink-600 font-bold hover:underline mx-auto"
            >
              <ArrowLeft size={16} />
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
