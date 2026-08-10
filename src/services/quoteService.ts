import { Quote, QuoteItem, QuoteStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado.');
  }
  return supabase;
}

function mapStatus(status: string): QuoteStatus {
  return status === 'rejected' ? 'declined' : (status as QuoteStatus);
}

function mapQuote(row: any, items: QuoteItem[] = []): Quote {
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  return {
    id: row.id,
    workspaceId: row.organization_id,
    customerId: row.customer_id,
    customerName: customer?.name || customer?.company_name || 'Cliente sem nome',
    customerEmail: customer?.email || undefined,
    customerTaxId: customer?.tax_id || undefined,
    customerAddress: customer?.address || undefined,
    quoteNumber: row.quote_number,
    items,
    subtotal: Number(row.subtotal || 0),
    taxRate: row.subtotal ? Number(((Number(row.tax_amount || 0) / Number(row.subtotal)) * 100).toFixed(2)) : 0,
    taxAmount: Number(row.tax_amount || 0),
    total: Number(row.total || 0),
    status: mapStatus(row.status),
    validUntil: row.valid_until || '',
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export const quoteService = {
  async getQuotes(organizationId: string): Promise<Quote[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('quotes')
      .select('*, customer:customers(name,company_name,email,tax_id,address), quote_items(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Não foi possível carregar os orçamentos: ${error.message}`);

    return (data || []).map((row: any) => {
      const items: QuoteItem[] = (row.quote_items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        total: Number(item.total || 0),
      }));
      return mapQuote(row, items);
    });
  },

  async addQuote(quoteData: Omit<Quote, 'id' | 'createdAt' | 'quoteNumber'>): Promise<Quote> {
    const client = requireSupabase();
    const { data: authData } = await client.auth.getUser();
    const { count, error: countError } = await client
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', quoteData.workspaceId);

    if (countError) throw new Error(`Não foi possível gerar o número do orçamento: ${countError.message}`);

    const year = new Date().getFullYear();
    const quoteNumber = `ORC-${year}-${String((count || 0) + 1).padStart(3, '0')}`;
    const dbStatus = quoteData.status === 'declined' ? 'rejected' : quoteData.status;

    const { data: row, error } = await client
      .from('quotes')
      .insert({
        organization_id: quoteData.workspaceId,
        customer_id: quoteData.customerId || null,
        quote_number: quoteNumber,
        status: dbStatus,
        issue_date: new Date().toISOString().slice(0, 10),
        valid_until: quoteData.validUntil || null,
        subtotal: quoteData.subtotal,
        tax_amount: quoteData.taxAmount,
        discount_amount: 0,
        total: quoteData.total,
        notes: quoteData.notes || null,
        created_by: authData.user?.id || null,
      })
      .select('*, customer:customers(name,company_name,email,tax_id,address)')
      .single();

    if (error) throw new Error(`Não foi possível criar o orçamento: ${error.message}`);

    if (quoteData.items.length) {
      const { error: itemsError } = await client.from('quote_items').insert(
        quoteData.items.map((item) => ({
          quote_id: row.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          tax_rate: quoteData.taxRate,
          discount: 0,
          total: item.total,
        })),
      );
      if (itemsError) throw new Error(`Orçamento criado, mas os itens falharam: ${itemsError.message}`);
    }

    return mapQuote(row, quoteData.items);
  },

  async updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
    const client = requireSupabase();
    const { data: row, error } = await client
      .from('quotes')
      .update({ status: status === 'declined' ? 'rejected' : status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, customer:customers(name,company_name,email,tax_id,address), quote_items(*)')
      .single();

    if (error) throw new Error(`Não foi possível atualizar o orçamento: ${error.message}`);
    return mapQuote(row, (row.quote_items || []).map((item: any) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      total: Number(item.total || 0),
    })));
  },

  async deleteQuote(id: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.from('quotes').delete().eq('id', id);
    if (error) throw new Error(`Não foi possível eliminar o orçamento: ${error.message}`);
  },
};
