import React, { useState } from 'react';

import {
  AuthProvider,
  useAuth,
} from './contexts/AuthContext';

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
import { ReportsPage } from './pages/ReportsPage';

import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    user,
    loading,
  } = useAuth();

  const [
    currentPath,
    setCurrentPath,
  ] = useState('/dashboard');

  const [
    pageAction,
    setPageAction,
  ] = useState<string | undefined>();

  const handleNavigate = (
    path: string,
    action?: string
  ) => {
    setCurrentPath(path);
    setPageAction(action);
  };

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

  /*
   * ============================================================
   * ROTAS PÚBLICAS
   * ============================================================
   */

  if (currentPath === '/') {
    return (
      <LandingPage
        onNavigate={handleNavigate}
      />
    );
  }

  if (!user) {
    if (
      currentPath === '/register'
    ) {
      return (
        <RegisterPage
          onNavigate={handleNavigate}
        />
      );
    }

    if (
      currentPath ===
      '/forgot-password'
    ) {
      return (
        <ForgotPasswordPage
          onNavigate={handleNavigate}
        />
      );
    }

    return (
      <LoginPage
        onNavigate={handleNavigate}
      />
    );
  }

  /*
   * ============================================================
   * PÁGINA PADRÃO
   * ============================================================
   */

  let pageComponent: React.ReactNode = (
    <DashboardPage
      onNavigate={handleNavigate}
    />
  );

  /*
   * ============================================================
   * ROTAS AUTENTICADAS
   * ============================================================
   */

  switch (currentPath) {
    case '/assistant':
      pageComponent = (
        <AssistantPage />
      );
      break;

    case '/customers':
      pageComponent = (
        <CustomersPage
          initialOpenModal={
            pageAction === 'new'
          }
        />
      );
      break;

    case '/quotes':
      pageComponent = (
        <QuotesPage
          initialOpenModal={
            pageAction === 'new'
          }
        />
      );
      break;

    case '/messages':
      pageComponent = (
        <MessagesPage />
      );
      break;

    case '/sales':
      pageComponent = (
        <SalesPage
          onNavigate={
            handleNavigate
          }
        />
      );
      break;

    case '/financial':
      pageComponent = (
        <FinancialPage />
      );
      break;

    case '/payments':
      pageComponent = (
        <PaymentsPage />
      );
      break;

    case '/plans':
      pageComponent = (
        <PlansPage />
      );
      break;

    case '/settings':
      pageComponent = (
        <SettingsPage />
      );
      break;

    /*
     * ========================================================
     * RELATÓRIOS
     * ========================================================
     */

    case '/reports':
      pageComponent = (
        <ReportsPage
          onNavigate={
            handleNavigate
          }
        />
      );
      break;

    /*
     * ========================================================
     * DASHBOARD
     * ========================================================
     */

    case '/dashboard':
    default:
      pageComponent = (
        <DashboardPage
          onNavigate={
            handleNavigate
          }
        />
      );
      break;
  }

  return (
    <MainLayout
      activePath={
        currentPath
      }
      onNavigate={
        handleNavigate
      }
    >
      {pageComponent}
    </MainLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
