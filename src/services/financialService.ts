import { FinancialTransaction, TransactionStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];

const STORAGE_KEY = 'stalmind_v2_financial_transactions';

export const financialService = {
  async getTransactions(workspaceId: string): Promise<FinancialTransaction[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('financial_transactions')
          .select('*')
          .eq('organization_id', workspaceId)
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
      id: crypto.randomUUID(),
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
