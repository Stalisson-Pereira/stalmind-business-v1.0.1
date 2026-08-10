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
  Menu,
  X,
  LogOut,
  Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { NotificationsPopover } from '../components/common/NotificationsPopover';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activePath, onNavigate }) => {
  const { user, workspace, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainNav = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/assistant', label: 'Assistente IA', icon: Bot, badge: 'AI' },
    { path: '/customers', label: 'Clientes', icon: Users },
    { path: '/quotes', label: 'Orçamentos', icon: FileText },
    { path: '/messages', label: 'Mensagens', icon: MessageSquare },
    { path: '/sales', label: 'Vendas', icon: TrendingUp, comingSoon: true },
    { path: '/financial', label: 'Financeiro', icon: CreditCard },
    { path: '/payments', label: 'Pagamentos', icon: Wallet },
    { path: '/reports', label: 'Relatórios', icon: BarChart2, comingSoon: true },
    { path: '/settings', label: 'Configurações', icon: Settings },
  ];

  const handleNav = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const todayFormatted = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const getUserInitials = () => {
    if (!user?.name) return 'S';
    const parts = user.name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <div className="h-screen w-screen max-w-full bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-[#0F172A] flex-col border-r border-slate-800 h-full shrink-0 overflow-hidden">
        <div className="p-6 flex flex-col gap-5 flex-1 min-h-0 overflow-y-auto">
          {/* Header Area with Brand Logo & ThemeToggle */}
          <div className="sidebar-header flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div
              onClick={() => handleNav('/dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <img
                src="/logo.svg"
                alt="Stalmind Logo"
                className="w-8 h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform shrink-0"
              />
              <span className="text-white text-xl font-bold tracking-tight">Stalmind.</span>
            </div>

            <ThemeToggle className="shrink-0" />
          </div>

          <div className="w-full h-px bg-slate-800/80 shrink-0" />

          {/* Navigation Links */}
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  id={`nav-link-${item.path.replace('/', '')}`}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white bg-indigo-600'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {item.badge}
                    </span>
                  )}
                  {item.comingSoon && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                      Em breve
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer Section */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 shrink-0">
          <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                {getUserInitials()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate">{user?.name || 'Usuário'}</p>
                <p className="text-[10px] font-medium text-slate-400 truncate">{workspace?.name || 'Plano Pro'}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sair da Conta"
              id="logout-btn"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Sair da conta</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <div className="sidebar-header md:hidden flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-[#0F172A] text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => handleNav('/dashboard')}>
          <img src="/logo.svg" alt="Stalmind Logo" className="w-7 h-7 rounded-lg shrink-0" />
          <span className="font-bold text-base tracking-tight">Stalmind.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 rounded-lg border border-slate-800 hover:bg-slate-800 shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col">
          <div className="bg-[#0F172A] text-white w-4/5 max-w-sm h-full p-6 flex flex-col justify-between border-r border-slate-800 shadow-xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <img src="/logo.svg" alt="Stalmind Logo" className="w-7 h-7 rounded-lg" />
                  <span className="font-bold text-lg tracking-tight">Stalmind.</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePath === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNav(item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold text-indigo-900">
                  {getUserInitials()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-slate-500">Plano Pro</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-rose-400"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-8 shrink-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
            {getGreeting()}, {user?.name ? `${user.name}.` : 'bem-vindo ao Stalmind.'}
          </h1>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium hidden sm:inline">
              {todayFormatted}
            </span>
            <NotificationsPopover />
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
