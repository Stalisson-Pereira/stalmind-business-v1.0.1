import React from 'react';
import { UserPlus, FilePlus, Bot, Send } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      icon: UserPlus,
      title: 'Cadastre seus clientes',
      description: 'Organize contatos, histórico de notas e dados fiscais (NIF) em um único cadastro centralizado.',
    },
    {
      number: '02',
      icon: FilePlus,
      title: 'Gere orçamentos em minutos',
      description: 'Crie propostas comerciais detalhadas com IVA e prazos ajustados com cálculo automático.',
    },
    {
      number: '03',
      icon: Bot,
      title: 'Utilize a IA para se comunicar',
      description: 'Gere textos de follow-up, propostas e respostas profissionais com o Stalmind AI.',
    },
    {
      number: '04',
      icon: Send,
      title: 'Envie e converta mais vendas',
      description: 'Acompanhe o estado de cada proposta de Rascunho a Aceito com relatórios claros.',
    },
  ];

  return (
    <section id="como-funciona" className="py-20 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Simplicidade no Fluxo
          </h2>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Como o Stalmind funciona
          </p>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">
            Quatro passos simples para transformar a gestão administrativa do seu negócio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-indigo-600/30 dark:text-indigo-400/30 font-mono">
                      {step.number}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
