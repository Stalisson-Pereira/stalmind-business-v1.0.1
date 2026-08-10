import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { customerService } from '../services/customerService';
import { quoteService } from '../services/quoteService';
import { supabase } from '../lib/supabaseClient';
import { Customer, Quote } from '../types';
import { Users, FileText, UserPlus, FilePlus, MessageSquare, Sparkles, Loader2 } from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string, action?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { workspace } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!workspace) return;
      setLoading(true);
      setLoadError(null);

      try {
        const [custs, qts] = await Promise.all([
          customerService.getCustomers(workspace.id),
          quoteService.getQuotes(workspace.id),
        ]);

        let confirmedSalesTotal = 0;
        if (supabase) {
          const { data: sales, error } = await supabase
            .from('sales')
            .select('total,status')
            .eq('organization_id', workspace.id)
            .in('status', ['confirmed']);

          if (error) throw new Error(`Não foi possível carregar as vendas: ${error.message}`);
          confirmedSalesTotal = (sales || []).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        }

        if (active) {
          setCustomers(custs);
          setQuotes(qts);
          setSalesTotal(confirmedSalesTotal);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o dashboard.');
          setCustomers([]);
          setQuotes([]);
          setSalesTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [workspace]);

  const currencySymbol = workspace?.currency === 'BRL' ? 'R$' : workspace?.currency === 'USD' ? '$' : '€';
  const pendingQuotesCount = quotes.filter((q) => q.status === 'sent' || q.status === 'draft').length;
  const acceptedQuotesTotal = quotes
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + Number(q.total || 0), 0);

  const formatMoney = (value: number) =>
    `${currencySymbol} ${value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Clientes" value={loading ? '—' : String(customers.length)} onClick={() => onNavigate('/customers')} />
        <MetricCard
          label="Orçamentos"
          value={loading ? '—' : String(quotes.length)}
          badge={loading ? undefined : `${pendingQuotesCount} pendentes`}
          badgeTone="amber"
          onClick={() => onNavigate('/quotes')}
        />
        <MetricCard
          label="Vendas confirmadas"
          value={loading ? '—' : formatMoney(salesTotal)}
          onClick={() => onNavigate('/quotes')}
        />
        <MetricCard
          label="Orçamentos aceitos"
          value={loading ? '—' : formatMoney(acceptedQuotesTotal)}
          badge="Previsto"
          onClick={() => onNavigate('/quotes')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 dark:text-white">Atividade recente</h4>
            <button onClick={() => onNavigate('/quotes')} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              Ver tudo
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center text-indigo-600"><Loader2 className="w-7 h-7 animate-spin" /></div>
          ) : quotes.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Ainda não há atividade</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Os orçamentos reais da sua organização aparecerão aqui.</p>
              <button onClick={() => onNavigate('/quotes', 'new')} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">
                Criar primeiro orçamento
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Data</th></tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {quotes.slice(0, 5).map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{q.customerName}</td>
                      <td className="px-5 py-4"><StatusBadge status={q.status} /></td>
                      <td className="px-5 py-4 font-mono font-medium text-slate-900 dark:text-slate-200">{formatMoney(q.total)}</td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{new Date(q.createdAt).toLocaleDateString('pt-PT')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-indigo-900 rounded-xl p-5 text-white flex flex-col shadow-lg">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-amber-300" /><h4 className="font-bold">Stalmind AI</h4></div>
            <p className="text-xs text-indigo-200 mb-4">Seu assistente inteligente para administrar o negócio.</p>
            <div className="bg-indigo-800/50 rounded-lg p-3 text-xs mb-3 italic text-indigo-100 border border-indigo-700/50">
              A IA analisará os dados reais da sua organização conforme eles forem cadastrados.
            </div>
            <button onClick={() => onNavigate('/assistant')} className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-bold transition-colors shadow-sm">Perguntar à IA</button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Ações rápidas</h4>
            <div className="grid grid-cols-1 gap-2">
              <QuickAction icon={<UserPlus className="w-4 h-4 text-indigo-500" />} label="Novo cliente" onClick={() => onNavigate('/customers', 'new')} />
              <QuickAction icon={<FilePlus className="w-4 h-4 text-indigo-500" />} label="Criar orçamento" onClick={() => onNavigate('/quotes', 'new')} />
              <QuickAction icon={<MessageSquare className="w-4 h-4 text-indigo-500" />} label="Escrever mensagem" onClick={() => onNavigate('/messages')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; badge?: string; badgeTone?: 'amber'; onClick?: () => void }> = ({ label, value, badge, badgeTone, onClick }) => (
  <div onClick={onClick} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500/40 transition-colors">
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <div className="flex items-end justify-between gap-2">
      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
      {badge && <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeTone === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400' : 'text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400'}`}>{badge}</span>}
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: Quote['status'] }> = ({ status }) => {
  const styles = status === 'accepted'
    ? 'bg-green-100 text-green-700 dark:bg-emerald-950/80 dark:text-emerald-400'
    : status === 'sent'
      ? 'bg-blue-100 text-blue-700 dark:bg-indigo-950/80 dark:text-indigo-400'
      : status === 'declined'
        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  const label = status === 'accepted' ? 'Aceito' : status === 'sent' ? 'Enviado' : status === 'declined' ? 'Recusado' : status === 'expired' ? 'Expirado' : 'Rascunho';
  return <span className={`px-2 py-1 text-xs rounded-full font-medium ${styles}`}>{label}</span>;
};

const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg text-sm font-medium border border-slate-100 dark:border-slate-800 transition-colors text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300">
    {icon}<span>{label}</span>
  </button>
);
