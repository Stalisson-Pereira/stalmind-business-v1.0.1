import React from 'react';
import { Sparkles } from 'lucide-react';

interface FooterSectionProps {
  onNavigate: (path: string) => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Stalmind Logo" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="font-bold text-white text-base tracking-tight block">Stalmind.</span>
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block -mt-1">
                The Intelligent Business Operating System
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300 font-medium">
            <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
              Início
            </button>
            <button onClick={() => onNavigate('/login')} className="hover:text-white transition-colors">
              Entrar
            </button>
            <button onClick={() => onNavigate('/register')} className="hover:text-white transition-colors">
              Criar Conta
            </button>
          </div>

          <p className="text-slate-500">
            © {new Date().getFullYear()} Stalmind Business OS. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
