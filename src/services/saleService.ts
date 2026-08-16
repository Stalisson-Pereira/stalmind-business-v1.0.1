import { supabase } from '../lib/supabaseClient';

export type SaleStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'refunded';

export interface Sale {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  quote_id: string | null;
  sale_number: string;
  status: SaleStatus;
  sale_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  total: number;
  created_at: string;
}

export interface CreateSaleInput {
  workspaceId: string;
  customerId?: string | null;
  quoteId?: string | null;
  description: string;
  quantity?: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  saleDate?: string;
  status?: SaleStatus;
  userId?: string | null;
}

const normalizeNumber = (value: unknown): number => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
};

const generateSaleNumber = (): string => {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, '0');

  const day = String(now.getDate()).padStart(2, '0');

  const random = Math.floor(1000 + Math.random() * 9000);

  return `VEN-${year}${month}${day}-${random}`;
};

export const saleService = {
  async getSales(workspaceId: string): Promise<Sale[]> {
    if (!workspaceId) {
      return [];
    }

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('[saleService.getSales]', error);
      throw new Error(`Não foi possível carregar as vendas: ${error.message}`);
    }

    return (data ?? []) as Sale[];
  },

  async getSaleItems(saleIds: string[]): Promise<SaleItem[]> {
    if (!saleIds.length) {
      return [];
    }

    const { data, error } = await supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[saleService.getSaleItems]', error);
      throw new Error(
        `Não foi possível carregar os itens das vendas: ${error.message}`
      );
    }

    return (data ?? []) as SaleItem[];
  },

  async createSale(input: CreateSaleInput): Promise<Sale> {
    if (!input.workspaceId) {
      throw new Error('Workspace não identificado.');
    }

    if (!input.description.trim()) {
      throw new Error('A descrição da venda é obrigatória.');
    }

    const quantity = normalizeNumber(input.quantity ?? 1);
    const unitPrice = normalizeNumber(input.unitPrice);
    const taxRate = normalizeNumber(input.taxRate ?? 0);
    const discount = normalizeNumber(input.discount ?? 0);

    if (quantity <= 0) {
      throw new Error('A quantidade deve ser maior que zero.');
    }

    if (unitPrice <= 0) {
      throw new Error('O valor da venda deve ser maior que zero.');
    }

    if (taxRate < 0 || taxRate > 100) {
      throw new Error('A taxa de imposto deve estar entre 0% e 100%.');
    }

    if (discount < 0) {
      throw new Error('O desconto não pode ser negativo.');
    }

    const subtotal = quantity * unitPrice;

    const discountAmount = Math.min(discount, subtotal);

    const taxableAmount = Math.max(subtotal - discountAmount, 0);

    const taxAmount = taxableAmount * (taxRate / 100);

    const total = taxableAmount + taxAmount;

    const saleNumber = generateSaleNumber();

    const salePayload = {
      workspace_id: input.workspaceId,
      customer_id: input.customerId || null,
      quote_id: input.quoteId || null,
      sale_number: saleNumber,
      status: input.status ?? 'confirmed',
      sale_date: input.saleDate
        ? new Date(`${input.saleDate}T12:00:00`).toISOString()
        : new Date().toISOString(),
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      created_by: input.userId || null,
    };

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
      .select('*')
      .single();

    if (saleError) {
      console.error('[saleService.createSale.sale]', saleError);

      throw new Error(
        `Não foi possível registar a venda: ${saleError.message}`
      );
    }

    const itemPayload = {
      sale_id: sale.id,
      product_id: null,
      description: input.description.trim(),
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      discount: discountAmount,
      total,
    };

    const { error: itemError } = await supabase
      .from('sale_items')
      .insert(itemPayload);

    if (itemError) {
      console.error('[saleService.createSale.item]', itemError);

      // Tenta desfazer a venda se o item não puder ser criado.
      await supabase
        .from('sales')
        .delete()
        .eq('id', sale.id)
        .eq('workspace_id', input.workspaceId);

      throw new Error(
        `A venda não pôde ser concluída porque o item não foi criado: ${itemError.message}`
      );
    }

    return sale as Sale;
  },

  async updateStatus(
    saleId: string,
    workspaceId: string,
    status: SaleStatus
  ): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single();

    if (error) {
      console.error('[saleService.updateStatus]', error);

      throw new Error(
        `Não foi possível atualizar o estado da venda: ${error.message}`
      );
    }

    return data as Sale;
  },
};
