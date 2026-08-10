import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface HeroSectionProps {
  onNavigate: (path: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-violet-500/10 dark:bg-violet-500/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>The Intelligent Business Operating System</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Seu negócio <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400">
              mais inteligente.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            O Stalmind reúne clientes, orçamentos, mensagens e gestão empresarial em um único lugar, com inteligência artificial.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => onNavigate('/register')}
              id="hero-start-btn"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <span>Começar gratuitamente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('/login')}
              id="hero-login-btn"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-semibold text-sm transition-all shadow-xs"
            >
              Entrar
            </button>
          </div>

          {/* Micro trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Configuração em 2 minutos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>Dados protegidos</span>
            </div>
          </div>
        </div>

        {/* Dashboard Preview Graphic */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-4 shadow-2xl shadow-indigo-900/10 dark:shadow-indigo-950/50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-0.5 rounded-md">
                app.stalmind.com/dashboard
              </div>
              <div className="w-12" />
            </div>

            {/* Simulated UI Mock Preview */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Clientes Ativos</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">28</p>
                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full mt-2 inline-block">
                  +12% este mês
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Orçamentos Aceitos</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">14</p>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full mt-2 inline-block">
                  82% taxa de conversão
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Receita Prevista</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">€ 14.850</p>
                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full mt-2 inline-block">
                  4 propostas pendentes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
