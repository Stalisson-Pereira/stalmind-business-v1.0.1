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
      console.error('Erro ao ler orçamentos locais:', e);
    }
  }

  return INITIAL_QUOTES;
}

function saveLocalQuotes(list: Quote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const quoteService = {
  async getQuotes(workspaceId: string): Promise<Quote[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          quote_items (*)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((q: any) => ({
          id: q.id,
          workspaceId: q.workspace_id,
          customerId: q.customer_id,
          customerName: q.customer_name,
          customerEmail: q.customer_email,
          customerTaxId: q.customer_tax_id,
          customerAddress: q.customer_address,
          quoteNumber: q.quote_number,

          items: (q.quote_items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            taxRate: item.tax_rate,
            discount: item.discount,
            total: item.total,
          })),

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

      if (error) {
        console.error('Erro ao carregar orçamentos:', error);
      }
    }

    return getLocalQuotes().filter(
      (q) => q.workspaceId === workspaceId || !q.workspaceId
    );
  },

  async addQuote(
    quoteData: Omit<Quote, 'id' | 'createdAt' | 'quoteNumber'>
  ): Promise<Quote> {
    const list = getLocalQuotes();

    const count = list.length + 1;
    const year = new Date().getFullYear();

    const quoteNumber = `ORC-${year}-${String(count).padStart(3, '0')}`;

    /*
     * ============================================================
     * SUPABASE
     * ============================================================
     */

    if (isSupabaseConfigured && supabase) {
      // 1. Criar o orçamento
      const { data: quoteRow, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          workspace_id: quoteData.workspaceId,
          customer_id: quoteData.customerId || null,

          customer_name: quoteData.customerName || null,
          customer_email: quoteData.customerEmail || null,
          customer_tax_id: quoteData.customerTaxId || null,
          customer_address: quoteData.customerAddress || null,

          quote_number: quoteNumber,
          subtotal: quoteData.subtotal || 0,
          tax_rate: quoteData.taxRate ?? 23,
          tax_amount: quoteData.taxAmount || 0,
          total: quoteData.total || 0,

          status: quoteData.status || 'draft',
          valid_until: quoteData.validUntil || null,
          notes: quoteData.notes || null,

          created_by: null,
        })
        .select()
        .single();

      if (quoteError) {
        console.error('Erro ao criar orçamento:', quoteError);
        throw new Error(
          `Não foi possível criar o orçamento: ${quoteError.message}`
        );
      }

      if (!quoteRow) {
        throw new Error('Supabase não retornou o orçamento criado.');
      }

      // 2. Preparar os itens
      const items = (quoteData.items || []).map((item: any) => ({
        quote_id: quoteRow.id,
        product_id: item.productId || null,
        description: item.description || '',
        quantity: item.quantity ?? 1,
        unit_price: item.unitPrice ?? 0,
        tax_rate: item.taxRate ?? quoteData.taxRate ?? 23,
        discount: item.discount ?? 0,
        total: item.total ?? 0,
      }));

      // 3. Criar os itens em quote_items
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items);

        if (itemsError) {
          console.error('Erro ao criar itens do orçamento:', itemsError);

          // Remove o orçamento criado para não deixar registro incompleto
          await supabase
            .from('quotes')
            .delete()
            .eq('id', quoteRow.id);

          throw new Error(
            `Não foi possível criar os itens do orçamento: ${itemsError.message}`
          );
        }
      }

      // 4. Montar objeto final
      const newQuote: Quote = {
        ...quoteData,
        id: quoteRow.id,
        quoteNumber: quoteRow.quote_number,
        createdAt: quoteRow.created_at,
      };

      // 5. Salvar também localmente
      list.unshift(newQuote);
      saveLocalQuotes(list);

      return newQuote;
    }

    /*
     * ============================================================
     * FALLBACK LOCAL
     * ============================================================
     */

    const newQuote: Quote = {
      ...quoteData,
      quoteNumber,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    list.unshift(newQuote);
    saveLocalQuotes(list);

    return newQuote;
  },

  async updateQuoteStatus(
    id: string,
    status: QuoteStatus
  ): Promise<Quote> {
    const list = getLocalQuotes();
    const index = list.findIndex((q) => q.id === id);

    if (index === -1) {
      throw new Error('Orçamento não encontrado');
    }

    const updated = {
      ...list[index],
      status,
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar status:', error);

        throw new Error(
          `Não foi possível atualizar o status: ${error.message}`
        );
      }
    }

    list[index] = updated;
    saveLocalQuotes(list);

    return updated;
  },

  async deleteQuote(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      /*
       * quote_items deve ser removido primeiro caso
       * não exista ON DELETE CASCADE na FK.
       */
      const { error: itemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id);

      if (itemsError) {
        console.error(
          'Erro ao excluir itens do orçamento:',
          itemsError
        );

        throw new Error(
          `Não foi possível excluir os itens: ${itemsError.message}`
        );
      }

      const { error: quoteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (quoteError) {
        console.error(
          'Erro ao excluir orçamento:',
          quoteError
        );

        throw new Error(
          `Não foi possível excluir o orçamento: ${quoteError.message}`
        );
      }
    }

    const list = getLocalQuotes().filter((q) => q.id !== id);
    saveLocalQuotes(list);
  },
};