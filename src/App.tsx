import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layouts/MainLayout';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

import { DashboardPage } from './pages/DashboardPage';
import { AssistantPage } from './pages/AssistantPage';
import { CustomersPage } from './pages/CustomersPage';
import { QuotesPage } from './pages/QuotesPage';
import { MessagesPage } from './pages/MessagesPage';
import { FinancialPage } from './pages/FinancialPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PlansPage } from './pages/PlansPage';
import { SettingsPage } from './pages/SettingsPage';
import { SalesPage } from './pages/SalesPage';

import { BarChart3, Loader2 } from 'lucide-react';

type PageAction = string | undefined;

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>('/dashboard');
  const [pageAction, setPageAction] = useState<PageAction>(undefined);

  /**
   * Navegação centralizada da aplicação.
   *
   * Exemplos:
   * onNavigate('/customers')
   * onNavigate('/customers', 'new')
   * onNavigate('/quotes', 'new')
   */
  const handleNavigate = (path: string, action?: string) => {
    setCurrentPath(path);
    setPageAction(action);
  };

  /**
   * Tela de carregamento inicial.
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />

          <span className="text-xs font-semibold text-slate-400">
            A carregar Stalmind...
          </span>
        </div>
      </div>
    );
  }

  /**
   * ============================================================
   * ROTAS PÚBLICAS
   * ============================================================
   */

  if (currentPath === '/') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  /**
   * Usuário não autenticado.
   *
   * Qualquer rota protegida redireciona para LoginPage.
   */
  if (!user) {
    switch (currentPath) {
      case '/register':
        return <RegisterPage onNavigate={handleNavigate} />;

      case '/forgot-password':
        return <ForgotPasswordPage onNavigate={handleNavigate} />;

      case '/login':
      default:
        return <LoginPage onNavigate={handleNavigate} />;
    }
  }

  /**
   * ============================================================
   * ROTAS AUTENTICADAS
   * ============================================================
   */

  let pageComponent: React.ReactNode;

  switch (currentPath) {
    /**
     * Dashboard
     */
    case '/dashboard':
      pageComponent = (
        <DashboardPage onNavigate={handleNavigate} />
      );
      break;

    /**
     * Assistente IA
     */
    case '/assistant':
      pageComponent = <AssistantPage />;
      break;

    /**
     * Clientes
     */
    case '/customers':
      pageComponent = (
        <CustomersPage
          initialOpenModal={pageAction === 'new'}
        />
      );
      break;

    /**
     * Orçamentos
     */
    case '/quotes':
      pageComponent = (
        <QuotesPage
          initialOpenModal={pageAction === 'new'}
        />
      );
      break;

    /**
     * Mensagens
     */
    case '/messages':
      pageComponent = <MessagesPage />;
      break;

    /**
     * Vendas
     *
     * IMPORTANTE:
     * A SalesPage já existe e agora está realmente conectada
     * ao menu /sales.
     */
    case '/sales':
      pageComponent = (
        <SalesPage
          onNavigate={handleNavigate}
        />
      );
      break;

    /**
     * Financeiro
     */
    case '/financial':
      pageComponent = <FinancialPage />;
      break;

    /**
     * Pagamentos
     */
    case '/payments':
      pageComponent = <PaymentsPage />;
      break;

    /**
     * Planos e preços
     */
    case '/plans':
      pageComponent = <PlansPage />;
      break;

    /**
     * Configurações
     */
    case '/settings':
      pageComponent = <SettingsPage />;
      break;

    /**
     * Relatórios
     *
     * Mantido separado da SalesPage para não misturar
     * faturamento com relatórios analíticos.
     */
    case '/reports':
      pageComponent = (
        <ReportsComingSoon
          onNavigate={handleNavigate}
        />
      );
      break;

    /**
     * Rota desconhecida
     *
     * Em vez de deixar uma tela vazia, voltamos para o Dashboard.
     */
    default:
      pageComponent = (
        <NotFoundPage
          onNavigate={handleNavigate}
        />
      );
      break;
  }

  /**
   * Layout principal autenticado.
   */
  return (
    <MainLayout
      activePath={currentPath}
      onNavigate={handleNavigate}
    >
      {pageComponent}
    </MainLayout>
  );
};

/**
 * ============================================================
 * RELATÓRIOS — EM BREVE
 * ============================================================
 */

interface ReportsComingSoonProps {
  onNavigate: (path: string, action?: string) => void;
}

const ReportsComingSoon: React.FC<ReportsComingSoonProps> = ({
  onNavigate,
}) => {
  return (
    <div className="min-h-full flex items-center justify-center py-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-xl w-full shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5">
          <BarChart3 className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Relatórios
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          O módulo de relatórios avançados está em desenvolvimento.
          Em breve poderá analisar vendas, faturamento, clientes,
          produtos e indicadores do seu negócio.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          >
            Voltar ao Dashboard
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/sales')}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Ver Vendas
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ============================================================
 * ROTA NÃO ENCONTRADA
 * ============================================================
 */

interface NotFoundPageProps {
  onNavigate: (path: string, action?: string) => void;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onNavigate,
}) => {
  return (
    <div className="min-h-full flex items-center justify-center py-12">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-md w-full shadow-sm">
        <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
          404
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4">
          Página não encontrada
        </h2>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          A página que você tentou acessar não existe ou foi
          movida.
        </p>

        <button
          type="button"
          onClick={() => onNavigate('/dashboard')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
        >
          Ir para o Dashboard
        </button>
      </div>
    </div>
  );
};

/**
 * ============================================================
 * APP ROOT
 * ============================================================
 */

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
