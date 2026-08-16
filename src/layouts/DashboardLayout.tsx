import React, { useState } from 'react';

import {
  LayoutDashboard,
  Bot,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  CreditCard,
  Wallet,
  BarChart2,
  Settings,
  Crown,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { NotificationsPopover } from '../common/NotificationsPopover';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string, action?: string) => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  comingSoon?: boolean;
}

export const DashboardLayout: React.FC<
  DashboardLayoutProps
> = ({
  children,
  activePath,
  onNavigate,
}) => {
  const { user, workspace, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const mainNav: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      path: '/assistant',
      label: 'Assistente IA',
      icon: Bot,
      badge: 'AI',
    },
    {
      path: '/customers',
      label: 'Clientes',
      icon: Users,
    },
    {
      path: '/quotes',
      label: 'Orçamentos',
      icon: FileText,
    },
    {
      path: '/messages',
      label: 'Mensagens',
      icon: MessageSquare,
    },
    {
      path: '/sales',
      label: 'Vendas',
      icon: TrendingUp,
    },
    {
      path: '/financial',
      label: 'Financeiro',
      icon: CreditCard,
    },
    {
      path: '/payments',
      label: 'Pagamentos',
      icon: Wallet,
    },
    {
      path: '/plans',
      label: 'Planos & Preços',
      icon: Crown,
      badge: workspace?.plan
        ? workspace.plan.toUpperCase()
        : 'FREE',
    },
    {
      path: '/reports',
      label: 'Relatórios',
      icon: BarChart2,
    },
    {
      path: '/settings',
      label: 'Configurações',
      icon: Settings,
    },
  ];

  const handleNav = (
    path: string,
    action?: string
  ) => {
    const target = mainNav.find(
      (item) => item.path === path
    );

    if (target?.comingSoon) {
      return;
    }

    onNavigate(path, action);
    setMobileMenuOpen(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Bom dia';
    }

    if (hour < 18) {
      return 'Boa tarde';
    }

    return 'Boa noite';
  };

  const todayFormatted =
    new Date().toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getUserInitials = () => {
    const name = user?.name?.trim();

    if (!name) {
      return 'S';
    }

    const parts = name
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return parts[0][0].toUpperCase();
  };

  const planLabel =
    workspace?.plan?.toUpperCase() || 'FREE';

  return (
    <div className="h-screen w-screen max-w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-[#0F172A] flex-col border-r border-slate-800 h-full shrink-0 overflow-hidden">
        <div className="p-6 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
          {/* BRAND */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleNav('/dashboard')
              }
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <img
                src="/logo.svg"
                alt="Stalmind Logo"
                className="w-8 h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform"
              />

              <span className="text-white text-xl font-bold tracking-tight">
                Stalmind.
              </span>
            </button>

            <ThemeToggle className="shrink-0" />
          </div>

          <div className="w-full h-px bg-slate-800/80 shrink-0" />

          {/* NAVIGATION */}
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePath === item.path;

              return (
                <button
                  key={item.path}
                  type="button"
                  disabled={item.comingSoon}
                  onClick={() =>
                    handleNav(item.path)
                  }
                  id={`nav-link-${item.path.replace(
                    '/',
                    ''
                  )}`}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.comingSoon
                      ? 'text-slate-600 cursor-not-allowed'
                      : isActive
                        ? 'text-white bg-indigo-600'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />

                    <span className="truncate">
                      {item.label}
                    </span>
                  </div>

                  {item.badge && (
                    <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                      {item.badge}
                    </span>
                  )}

                </button>
              );
            })}
          </nav>
        </div>

        {/* USER FOOTER */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 shrink-0">
          <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <button
              type="button"
              onClick={() =>
                handleNav('/plans')
              }
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group text-left"
              title="Ver / Gerir Plano Atual"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                {getUserInitials()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate group-hover:text-indigo-400 transition-colors">
                  {user?.name || 'Usuário'}
                </p>

                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {planLabel}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={logout}
              title="Sair da Conta"
              id="logout-btn"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />

              <span className="sr-only">
                Sair da conta
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F172A] text-white border-b border-slate-800 sticky top-0 z-40">
        <button
          type="button"
          onClick={() =>
            handleNav('/dashboard')
          }
          className="flex items-center gap-2.5"
        >
          <img
            src="/logo.svg"
            alt="Stalmind Logo"
            className="w-7 h-7 rounded-lg"
          />

          <span className="font-bold text-base tracking-tight">
            Stalmind.
          </span>
        </button>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(
                (current) => !current
              )
            }
            className="p-2 text-slate-300 rounded-lg border border-slate-800 hover:bg-slate-800"
            aria-label={
              mobileMenuOpen
                ? 'Fechar menu'
                : 'Abrir menu'
            }
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs"
          onClick={() =>
            setMobileMenuOpen(false)
          }
        >
          <div
            className="bg-[#0F172A] text-white w-4/5 max-w-sm h-full p-6 flex flex-col justify-between border-r border-slate-800 shadow-xl animate-in slide-in-from-left duration-200"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() =>
                    handleNav('/dashboard')
                  }
                  className="flex items-center gap-2"
                >
                  <img
                    src="/logo.svg"
                    alt="Stalmind Logo"
                    className="w-7 h-7 rounded-lg"
                  />

                  <span className="font-bold text-lg tracking-tight">
                    Stalmind.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMobileMenuOpen(false)
                  }
                  className="p-1.5 text-slate-400 hover:text-white"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activePath === item.path;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      disabled={item.comingSoon}
                      onClick={() =>
                        handleNav(item.path)
                      }
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium ${
                        item.comingSoon
                          ? 'text-slate-600 cursor-not-allowed'
                          : isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />

                        <span>
                          {item.label}
                        </span>
                      </div>

                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {item.badge}
                        </span>
                      )}

                      {item.comingSoon && (
                        <span className="text-[8px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                          Em breve
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  handleNav('/plans')
                }
                className="flex items-center gap-3 min-w-0 text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                  {getUserInitials()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name || 'Usuário'}
                  </p>

                  <p className="text-xs text-slate-500">
                    Plano {planLabel}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-rose-400"
                aria-label="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-8 shrink-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
            {getGreeting()},{' '}
            {user?.name
              ? `${user.name}.`
              : 'bem-vindo ao Stalmind.'}
          </h1>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium hidden sm:inline">
              {todayFormatted}
            </span>

            <NotificationsPopover />
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
