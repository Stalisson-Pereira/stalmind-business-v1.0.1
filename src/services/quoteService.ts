import { Quote, QuoteStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const INITIAL_QUOTES: Quote[] = [];

const STORAGE_KEY = 'stalmind_v2_quotes';

function getLocalQuotes(): Quote[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

function saveLocalQuotes(list: Quote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const quoteService = {
  async getQuotes(workspaceId: string): Promise<Quote[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((q) => ({
          id: q.id,
          workspaceId: q.workspace_id,
          customerId: q.customer_id,
          customerName: q.customer_name,
          customerEmail: q.customer_email,
          customerTaxId: q.customer_tax_id,
          customerAddress: q.customer_address,
          quoteNumber: q.quote_number,
          items: q.items || [],
          subtotal: q.subtotal,
          taxRate: q.tax_rate,
          taxAmount: q.tax_amount,
          total: q.total,
          status: q.status,
          validUntil: q.valid_until,
          notes: q.notes,
          createdAt: q.created_at,
        }));
      }
    }

    return getLocalQuotes().filter((q) => q.workspaceId === workspaceId || !q.workspaceId);
  },

  async addQuote(quoteData: Omit<Quote, 'id' | 'createdAt' | 'quoteNumber'>): Promise<Quote> {
    const list = getLocalQuotes();
    const count = list.length + 1;
    const year = new Date().getFullYear();
    const quoteNumber = `ORC-${year}-${String(count).padStart(3, '0')}`;

    const newQuote: Quote = {
      ...quoteData,
      quoteNumber,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('quotes').insert({
        workspace_id: newQuote.workspaceId,
        customer_id: newQuote.customerId,
        customer_name: newQuote.customerName,
        customer_email: newQuote.customerEmail,
        customer_tax_id: newQuote.customerTaxId,
        customer_address: newQuote.customerAddress,
        quote_number: newQuote.quoteNumber,
        items: newQuote.items,
        subtotal: newQuote.subtotal,
        tax_rate: newQuote.taxRate,
        tax_amount: newQuote.taxAmount,
        total: newQuote.total,
        status: newQuote.status,
        valid_until: newQuote.validUntil,
        notes: newQuote.notes,
      });
    }

    list.unshift(newQuote);
    saveLocalQuotes(list);
    return newQuote;
  },

  async updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
    const list = getLocalQuotes();
    const index = list.findIndex((q) => q.id === id);
    if (index === -1) throw new Error('Orçamento não encontrado');

    const updated = { ...list[index], status };
    list[index] = updated;
    saveLocalQuotes(list);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('quotes').update({ status }).eq('id', id);
    }

    return updated;
  },

  async deleteQuote(id: string): Promise<void> {
    const list = getLocalQuotes().filter((q) => q.id !== id);
    saveLocalQuotes(list);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('quotes').delete().eq('id', id);
    }
  }
};
