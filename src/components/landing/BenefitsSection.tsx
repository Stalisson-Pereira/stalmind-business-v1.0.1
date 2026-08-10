import React from 'react';
import { Clock, ShieldCheck, Zap, TrendingUp, Layers, Sparkles } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const benefits = [
    {
      icon: Clock,
      title: 'Economize até 15 horas por semana',
      description:
        'Automatize a criação de orçamentos, acompanhamento de clientes e respostas frequentes para focar no que realmente importa.',
    },
    {
      icon: Zap,
      title: 'Respostas rápidas com Inteligência Artificial',
      description:
        'Gere propostas comerciais personalizadas e e-mails de cobrança educados em questão de segundos.',
    },
    {
      icon: Layers,
      title: 'Tudo integrado em uma só tela',
      description:
        'Chega de espalhar dados entre planilhas soltas, blocos de notas e aplicativos de mensagens descentralizados.',
    },
    {
      icon: TrendingUp,
      title: 'Aumente a conversão de orçamentos',
      description:
        'Propostas organizadas, elegantes e com acompanhamento estratégico aumentam a taxa de aprovação dos seus clientes.',
    },
    {
      icon: ShieldCheck,
      title: 'Profissionalismo de grande empresa',
      description:
        'Transmita confiança com documentos limpos, comunicação estruturada e um atendimento ágil desde o primeiro contato.',
    },
    {
      icon: Sparkles,
      title: 'Pronto para crescer com você',
      description:
        'Arquitetura multi-tenant desenhada para acompanhar a evolução do seu negócio, de solo-pro a equipes em expansão.',
    },
  ];

  return (
    <section id="beneficios" className="py-20 bg-white dark:bg-slate-900 border-y border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Por que escolher o Stalmind
          </h2>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Benefícios pensados para o seu dia a dia
          </p>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">
            Simplifique a administração e ganhe mais tempo para gerar receita e atender melhor seus clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 hover:border-indigo-500/50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                  {b.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {b.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
