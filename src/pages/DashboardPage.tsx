import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { customerService } from '../services/customerService';
import { quoteService } from '../services/quoteService';
import { Customer, Quote } from '../types';
import {
  Users,
  FileText,
  UserPlus,
  FilePlus,
  MessageSquare,
  Sparkles,
  Bot,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string, action?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { workspace } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!workspace) return;
      try {
        const custs = await customerService.getCustomers(workspace.id);
        const qts = await quoteService.getQuotes(workspace.id);
        setCustomers(custs);
        setQuotes(qts);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [workspace]);

  const currencySymbol = workspace?.currency === 'BRL' ? 'R$' : workspace?.currency === 'USD' ? '$' : '€';

  const pendingQuotesCount = quotes.filter((q) => q.status === 'sent' || q.status === 'draft').length;
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted');
  const salesTotal = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Clientes */}
        <div
          onClick={() => onNavigate('/customers')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500/40 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Clientes
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {customers.length}
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">
              Total
            </span>
          </div>
        </div>

        {/* Metric 2: Orçamentos */}
        <div
          onClick={() => onNavigate('/quotes')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500/40 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Orçamentos
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {quotes.length}
            </h3>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded">
              {pendingQuotesCount} pendentes
            </span>
          </div>
        </div>

        {/* Metric 3: Vendas */}
        <div
          onClick={() => onNavigate('/quotes')}
          className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500/40 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Vendas
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {currencySymbol} {salesTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </h3>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded">
              Aprovado
            </span>
          </div>
        </div>

        {/* Metric 4: Receita */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Receita Estimada
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {currencySymbol} {(salesTotal * 0.7).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">
              Este mês
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Atividade Recente + Side Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Atividade Recente Table (Col 1 & 2) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 dark:text-white">Atividade recente</h4>
            <button
              onClick={() => onNavigate('/quotes')}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Ver tudo
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                {quotes.length > 0 ? (
                  quotes.slice(0, 4).map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                        {q.customerName}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium ${q.status === 'accepted'
                              ? 'bg-green-100 dark:bg-emerald-950/80 text-green-700 dark:text-emerald-400'
                              : q.status === 'sent'
                                ? 'bg-blue-100 dark:bg-indigo-950/80 text-blue-700 dark:text-indigo-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                          {q.status === 'rejected'
                            ? 'Aceito'
                            : q.status === 'sent'
                              ? 'Enviado'
                              : q.status === 'rejected'
                                ? 'Recusado'
                                : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono font-medium text-slate-900 dark:text-slate-200">
                        {currencySymbol} {q.total.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(q.createdAt).toLocaleDateString('pt-PT')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                      Nenhum orçamento registado. Crie o seu primeiro orçamento para começar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (Stalmind AI + Quick Actions) */}
        <div className="flex flex-col gap-6">
          {/* Stalmind AI Banner Card */}
          <div className="bg-indigo-900 rounded-xl p-5 text-white flex flex-col shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <h4 className="font-bold">Stalmind AI</h4>
            </div>
            <p className="text-xs text-indigo-200 mb-4">
              Seu assistente inteligente para administrar o negócio.
            </p>
            <div className="bg-indigo-800/50 rounded-lg p-3 text-xs mb-3 italic text-indigo-100 border border-indigo-700/50">
              {pendingQuotesCount > 0
                ? `Possui ${pendingQuotesCount} orçamento(s) pendente(s). Posso ajudar a redigir mensagens de acompanhamento.`
                : 'Olá! Estou pronto para ajudar na gestão de clientes, orçamentos e dados financeiros.'}
            </div>
            <button
              onClick={() => onNavigate('/assistant')}
              id="dash-ask-ai-btn"
              className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              Perguntar à IA
            </button>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Ações rápidas</h4>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onNavigate('/customers', 'new')}
                id="quick-add-customer-btn"
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-sm font-medium border border-slate-100 dark:border-slate-800 transition-colors text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Novo cliente</span>
              </button>

              <button
                onClick={() => onNavigate('/quotes', 'new')}
                id="quick-create-quote-btn"
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-sm font-medium border border-slate-100 dark:border-slate-800 transition-colors text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <FilePlus className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Criar orçamento</span>
              </button>

              <button
                onClick={() => onNavigate('/messages')}
                id="quick-write-msg-btn"
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-sm font-medium border border-slate-100 dark:border-slate-800 transition-colors text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Escrever mensagem</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
