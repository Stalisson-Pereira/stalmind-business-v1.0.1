import React from 'react';
import { UserCheck, Building, Briefcase, Rocket } from 'lucide-react';

export const TargetAudienceSection: React.FC = () => {
  const audiences = [
    {
      icon: Briefcase,
      title: 'Autónomos e Freelancers',
      description: 'Consultores, designers, programadores, fotógrafos e tradutores que precisam de um sistema prático para organizar clientes e orçamentos.',
    },
    {
      icon: Building,
      title: 'Microempresas',
      description: 'Prestadores de serviços locais e pequenas agências que desejam profissionalizar o atendimento comercial sem complexidade desnecessária.',
    },
    {
      icon: Rocket,
      title: 'Pequenas Empresas em Crescimento',
      description: 'Equipes comerciais que precisam centralizar dados de clientes e acelerar a emissão e aprovação de propostas.',
    },
  ];

  return (
    <section className="py-20 bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Para Quem É O Stalmind
          </h2>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Desenhado sob medida para o seu perfil
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {audiences.map((aud) => {
            const Icon = aud.icon;
            return (
              <div
                key={aud.title}
                className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {aud.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {aud.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
