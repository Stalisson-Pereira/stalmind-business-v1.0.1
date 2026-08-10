import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface CTASectionProps {
  onNavigate: (path: string) => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onNavigate }) => {
  return (
    <section className="py-20 bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-900 text-white relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-6 text-indigo-200">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
          Pronto para transformar a gestão do seu negócio?
        </h2>
        <p className="mt-4 text-base text-indigo-100 max-w-2xl mx-auto">
          Junte-se a profissionais e empresas que organizam clientes, orçamentos e mensagens com o Stalmind Business OS.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => onNavigate('/register')}
            id="cta-register-btn"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white text-indigo-900 font-bold text-sm shadow-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
          >
            <span>Começar gratuitamente agora</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
