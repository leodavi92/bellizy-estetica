import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ========================
 *  PROTECTED ROUTE WRAPPER
 * ========================
 * Componente de controle de acesso de rotas no nível do React Router.
 * Resolve:
 *   - Usuário deslogado → redireciona para /login (mantém query `from` para retorno).
 *   - Usuário logado MAS sem permissão:
 *       - Se tipo `cliente` tentando rotas admin → redirect para /client (ou última estética salva).
 *       - Se tipo `staff` tentando `financeiro` / `equipe` → redirect de volta para `/admin`.
 *       - Se tipo `admin/staff` tentando rota de cliente → redireciona `/admin`.
 *
 * Props:
 *   children            : O componente a ser renderizado se autorizado.
 *   allowedRoles        : ['admin' | 'staff' | 'client' | 'owner' | 'any'][] — se omitido = precisa só estar autenticado.
 *   unauthenticatedTo   : fallback URL quando usuário não está logado. Default /login.
 *   unauthorizedTo      : fallback URL quando logado mas sem roles. Default = com base no tipo.
 */
export default function ProtectedRoute({
  children,
  allowedRoles = [],
  unauthenticatedTo = '/login',
  unauthorizedTo = null,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Enquanto auth está carregando, mostra loading para evitar Flash of Unauthorized Content.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-pink-600">
        <div className="animate-pulse text-sm font-bold tracking-widest uppercase">
          Carregando…
        </div>
      </div>
    );
  }

  // 1. NÃO AUTENTICADO → login (retém `from` para voltar após login)
  if (!user) {
    return (
      <Navigate
        to={unauthenticatedTo}
        state={{ from: location.pathname + location.search + location.hash }}
        replace
      />
    );
  }

  // 2. ROLE `any` ou lista VAZIA → qualquer usuário autenticado passa
  const anyRole = allowedRoles.length === 0 || allowedRoles.includes('any');
  const roleMatch = anyRole || allowedRoles.some((r) => r === user.tipo);

  if (roleMatch) {
    return children;
  }

  // 3. NÃO TEM ROLE — fallbacks inteligentes por tipo
  const fallbackByUserType = unauthorizedTo || (() => {
    switch (user.tipo) {
      case 'admin':
      case 'staff':
        return '/admin';
      case 'cliente':
      case 'client':
      default:
        return '/client';
    }
  })();

  return <Navigate to={fallbackByUserType} replace />;
}
