import React from 'react';
import { Users, FileText, MessageSquare, Bot, Building2, BarChart2 } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: Users,
      title: 'Gestão Completa de Clientes',
      items: ['Cadastro detalhado com NIF e morada', 'Histórico de propostas e notas', 'Filtros rápidos por estado (Ativo, Lead, Inativo)'],
    },
    {
      icon: FileText,
      title: 'Gerador de Orçamentos Profissionais',
      items: ['Cálculo automático de subtotal, IVA e total', 'Estados claros: Rascunho, Enviado, Aceito', 'Modelo pronto para visualização e impressão PDF'],
    },
    {
      icon: MessageSquare,
      title: 'Centro de Mensagens Comerciais',
      items: ['Modelos para cobrança, agradecimento e follow-up', 'Abertura direta no WhatsApp ou E-mail', 'Assistência de escrita com tom profissional'],
    },
    {
      icon: Bot,
      title: 'Stalmind AI Assistant',
      items: ['Aconselhamento sobre estratégia de vendas', 'Criação de propostas e revisão de textos', 'Insights rápidos sobre carteira de clientes'],
    },
    {
      icon: Building2,
      title: 'Arquitetura Multi-Tenant & Empresa',
      items: ['Personalização de taxa de IVA e moeda (EUR, USD, BRL)', 'Dados fiscais da empresa na cabeçalho dos documentos', 'Suporte a múltiplos membros de equipe'],
    },
    {
      icon: BarChart2,
      title: 'Relatórios & Métricas em Tempo Real',
      items: ['Total de vendas e propostas ativas', 'Taxa de aceitação de orçamentos', 'Atividade recente consolidada'],
    },
  ];

  return (
    <section id="recursos" className="py-20 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Módulos Funcionais
          </h2>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Recursos construídos para produtividade
          </p>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">
            Ferramentas integradas para gerir clientes, propostas e comunicação de forma ágil.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4 shadow-md shadow-indigo-600/20">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
                    {f.title}
                  </h3>
                  <ul className="space-y-2">
                    {f.items.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
