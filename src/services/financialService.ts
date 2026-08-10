import { FinancialTransaction, TransactionStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const INITIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'tx_01',
    workspaceId: 'ws_01',
    type: 'income',
    title: 'Adjudicação de Projeto Website - Nexus Tech',
    amount: 2500,
    category: 'Vendas & Serviços',
    status: 'paid',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Nexus Tech Lda',
    paymentMethod: 'Transferência Bancária',
    notes: '50% de entrada referente ao orçamento #ORC-2026-001',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx_02',
    workspaceId: 'ws_01',
    type: 'income',
    title: 'Consultoria de Estratégia Digital - Oliveira Studio',
    amount: 1200,
    category: 'Consultoria',
    status: 'paid',
    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Oliveira & Filhos Studio',
    paymentMethod: 'MB WAY',
    notes: 'Sessões mensais de mentoria de produto',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx_03',
    workspaceId: 'ws_01',
    type: 'income',
    title: 'Subscrição Mensal de Manutenção App',
    amount: 450,
    category: 'Vendas & Serviços',
    status: 'pending',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Bloom Arquitetura',
    paymentMethod: 'Débito Direto',
    notes: 'Fatura mensal de alojamento e suporte',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_04',
    workspaceId: 'ws_01',
    type: 'expense',
    title: 'Subscrições de Software (Figma & Vercel)',
    amount: 185,
    category: 'Software & Ferramentas',
    status: 'paid',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Vercel Inc / Figma',
    paymentMethod: 'Cartão de Crédito',
    notes: 'Licenças de design e alojamento web',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx_05',
    workspaceId: 'ws_01',
    type: 'expense',
    title: 'Campanha de Marketing Digital (Google & Meta Ads)',
    amount: 350,
    category: 'Marketing & Anúncios',
    status: 'paid',
    date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Google Ireland / Meta',
    paymentMethod: 'Cartão de Crédito',
    notes: 'Anúncios de angariação de novos clientes',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tx_06',
    workspaceId: 'ws_01',
    type: 'expense',
    title: 'Aluguer de Espaço de Coworking',
    amount: 600,
    category: 'Instalações & Aluguer',
    status: 'pending',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Porto Innovation Hub',
    paymentMethod: 'Transferência Bancária',
    notes: 'Renda mensal do escritório',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx_07',
    workspaceId: 'ws_01',
    type: 'income',
    title: 'Desenvolvimento de Automação de Processos',
    amount: 3200,
    category: 'Vendas & Serviços',
    status: 'overdue',
    date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerOrSupplier: 'Santos Logística',
    paymentMethod: 'Transferência Bancária',
    notes: 'Lembrete enviado ao cliente via WhatsApp',
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const STORAGE_KEY = 'stalmind_financial_transactions';

export const financialService = {
  async getTransactions(workspaceId: string): Promise<FinancialTransaction[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('financial_transactions')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('date', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((t: any) => ({
            id: t.id,
            workspaceId: t.workspace_id,
            type: t.type,
            title: t.title,
            amount: t.amount,
            category: t.category,
            status: t.status,
            date: t.date,
            dueDate: t.due_date,
            customerOrSupplier: t.customer_or_supplier,
            paymentMethod: t.payment_method,
            notes: t.notes,
            createdAt: t.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch financial failed, falling back to local storage:', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
      return INITIAL_TRANSACTIONS.filter((t) => t.workspaceId === workspaceId);
    }

    try {
      const parsed: FinancialTransaction[] = JSON.parse(raw);
      return parsed.filter((t) => t.workspaceId === workspaceId);
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  },

  async addTransaction(tx: Omit<FinancialTransaction, 'id' | 'createdAt'>): Promise<FinancialTransaction> {
    const newTx: FinancialTransaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('financial_transactions').insert([
          {
            id: newTx.id,
            workspace_id: newTx.workspaceId,
            type: newTx.type,
            title: newTx.title,
            amount: newTx.amount,
            category: newTx.category,
            status: newTx.status,
            date: newTx.date,
            due_date: newTx.dueDate,
            customer_or_supplier: newTx.customerOrSupplier,
            payment_method: newTx.paymentMethod,
            notes: newTx.notes,
            created_at: newTx.createdAt,
          },
        ]);
      } catch (err) {
        console.warn('Supabase insert transaction error:', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: FinancialTransaction[] = raw ? JSON.parse(raw) : INITIAL_TRANSACTIONS;
    const updated = [newTx, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return newTx;
  },

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('financial_transactions').update({ status }).eq('id', id);
      } catch (err) {
        console.warn('Supabase update status error:', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const existing: FinancialTransaction[] = JSON.parse(raw);
      const updated = existing.map((t) => (t.id === id ? { ...t, status } : t));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('financial_transactions').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete transaction error:', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const existing: FinancialTransaction[] = JSON.parse(raw);
      const updated = existing.filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },
};
