import React from 'react';
import { Bot, Sparkles, Send, MessageSquareText, ShieldAlert } from 'lucide-react';

export const AIAssistantSection: React.FC = () => {
  return (
    <section id="assistente-ia" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-indigo-600/20 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stalmind AI Engine</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Seu copiloto inteligente para administrar o negócio.
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Diga adeus à folha em branco. O Stalmind AI analisa o contexto dos seus orçamentos e clientes para sugerir textos persuasivos, estratégias de precificação e lembretes de cobrança sem constrangimento.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Conselhos Executivos 24/7</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tire dúvidas sobre como lidar com atrasos de clientes ou calcular margem de lucro.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquareText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Redação de Propostas Comerciais</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gere escopos detalhados com justificativa de valor para impressionar o contratante.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Mock Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Stalmind AI</p>
                <p className="text-[10px] text-emerald-400 font-medium">Assistente de Gestão Ativo</p>
              </div>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl max-w-[85%] text-slate-300">
                Como posso responder educadamente a um cliente que está atrasado com a aprovação da proposta?
              </div>
              <div className="bg-indigo-950/60 border border-indigo-800/60 p-3.5 rounded-xl ml-auto max-w-[90%] text-indigo-100 leading-relaxed">
                <p className="font-semibold text-indigo-300 mb-1">Sugestão de resposta:</p>
                "Olá Mariana! Passando para saber se teve oportunidade de rever a nossa proposta de consultoria. Como estamos com disponibilidade de agenda limitada para este mês, gostaríamos de confirmar para reservar a sua vaga. Abraço!"
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-500 text-xs">
              <span>Pergunte algo à IA...</span>
              <Send className="w-3.5 h-3.5 ml-auto text-indigo-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
