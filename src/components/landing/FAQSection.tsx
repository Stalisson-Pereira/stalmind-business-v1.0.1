import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      q: 'O que é o Stalmind Business OS?',
      a: 'O Stalmind é um sistema operacional inteligente para pequenos negócios, reunindo gestão de clientes, criação de orçamentos, modelos de mensagens e assistente de IA em uma única plataforma.',
    },
    {
      q: 'Preciso de conhecimentos prévios de tecnologia para utilizar?',
      a: 'Não. A interface foi desenhada com foco em simplicidade e usabilidade intuitiva. Em menos de 2 minutos você já pode cadastrar seu primeiro cliente e gerar um orçamento.',
    },
    {
      q: 'Como funciona a integração com Inteligência Artificial?',
      a: 'O Stalmind AI auxilia na redação de propostas, no esclarecimento de dúvidas operacionais e no planejamento de respostas comerciais estrategicamente estruturadas.',
    },
    {
      q: 'Posso utilizar o Stalmind no telemóvel / smartphone?',
      a: 'Sim! O Stalmind é 100% responsivo e preparado para uso em desktop, tablet, Android e iPhone com suporte a PWA.',
    },
    {
      q: 'Como funciona a segurança dos meus dados?',
      a: 'A arquitetura é preparada com isolamento de workspace (multi-tenant) e conexões criptografadas de alto nível através do Supabase.',
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Perguntas Frequentes
          </h2>
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ficou com alguma dúvida?
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-semibold text-sm text-slate-900 dark:text-white"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
