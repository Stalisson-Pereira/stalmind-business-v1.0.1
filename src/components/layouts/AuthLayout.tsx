import React from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  onNavigateHome: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  onNavigateHome,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-y-auto">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full z-10">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao site
        </button>
        <ThemeToggle className="bg-slate-800/80 border-slate-700 text-slate-200" />
      </header>

      {/* Card Form */}
      <div className="max-w-md w-full mx-auto my-auto py-8 z-10">
        <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-md">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-8">
            <div
              onClick={onNavigateHome}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 cursor-pointer hover:scale-105 transition-transform"
            >
              <img src="/logo.svg" alt="Stalmind Logo" className="w-12 h-12 rounded-xl" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Stalmind.</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mt-0.5">
              Business OS
            </span>
            <h1 className="text-2xl font-bold text-white mt-6 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-500 z-10 py-2">
        © {new Date().getFullYear()} Stalmind Business OS. Todos os direitos reservados.
      </footer>
    </div>
  );
};
