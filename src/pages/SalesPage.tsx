import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Search,
  Plus,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  BarChart3,
  Percent,
  XCircle,
  RotateCcw,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Modal } from '../components/common/Modal';

interface SalesPageProps {
  onNavigate?: (path: string, action?: string) => void;
}

type SaleStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'refunded';

type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

interface Customer {
  id: string;
  name: string;
  company_name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface Sale {
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
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer | null;
}

interface Quote {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  quote_number: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_tax_id?: string | null;
  customer_address?: string | null;
}

interface SaleRecord {
  id: string;
  source: 'sale' | 'quote';
  title: string;
  customer: string;
  amount: number;
  date: string;
  status: SaleStatus | 'accepted';
  saleNumber?: string;
  method?: string;
}

const getCustomerDisplayName = (customer?: Customer | null) => {
  if (!customer) return 'Cliente Geral';

  if (customer.company_name?.trim()) {
    return customer.company_name;
  }

  if (customer.company?.trim()) {
    return customer.company;
  }

  return customer.name || 'Cliente Geral';
};

const normalizeAmount = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (
  value: number,
  currencySymbol: string
) => {
  return `${currencySymbol} ${value.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const escapeCSV = (value: unknown) => {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
};

export const SalesPage: React.FC<SalesPageProps> = ({
  onNavigate,
}) => {
  const { workspace, user } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<
    'all' | 'month' | 'quarter' | 'year'
  >('all');

  const [typeTab, setTypeTab] = useState<
    'all' | 'sales' | 'quotes'
  >('all');

  // Modal
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleTitle, setSaleTitle] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [saleNotes, setSaleNotes] = useState('');

  const currencySymbol =
    workspace?.currency === 'BRL'
      ? 'R$'
      : workspace?.currency === 'USD'
      ? '$'
      : '€';

  /**
   * Carrega vendas, orçamentos e clientes.
   *
   * IMPORTANTE:
   * Não utiliza financial_transactions.
   */
  const loadData = useCallback(async () => {
    if (!workspace?.id) {
      setSales([]);
      setQuotes([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        salesResponse,
        quotesResponse,
        customersResponse,
      ] = await Promise.all([
        supabase
          .from('sales')
          .select(`
            id,
            workspace_id,
            customer_id,
            quote_id,
            sale_number,
            status,
            sale_date,
            subtotal,
            tax_amount,
            discount_amount,
            total,
            created_by,
            created_at,
            updated_at,
            customer:customers (
              id,
              name,
              company_name,
              company,
              email,
              phone
            )
          `)
          .eq('workspace_id', workspace.id)
          .order('sale_date', { ascending: false }),

        supabase
          .from('quotes')
          .select(`
            id,
            workspace_id,
            customer_id,
            quote_number,
            status,
            issue_date,
            valid_until,
            subtotal,
            tax_amount,
            discount_amount,
            total,
            notes,
            customer_name,
            customer_email,
            customer_tax_id,
            customer_address
          `)
          .eq('workspace_id', workspace.id)
          .order('issue_date', { ascending: false }),

        supabase
          .from('customers')
          .select(`
            id,
            name,
            company_name,
            company,
            email,
            phone
          `)
          .eq('workspace_id', workspace.id)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (salesResponse.error) {
        throw new Error(
          `Erro ao carregar vendas: ${salesResponse.error.message}`
        );
      }

      if (quotesResponse.error) {
        throw new Error(
          `Erro ao carregar orçamentos: ${quotesResponse.error.message}`
        );
      }

      if (customersResponse.error) {
        throw new Error(
          `Erro ao carregar clientes: ${customersResponse.error.message}`
        );
      }

      const normalizedSales = (salesResponse.data || []).map(
        (sale: any) => ({
          ...sale,
          subtotal: normalizeAmount(sale.subtotal),
          tax_amount: normalizeAmount(sale.tax_amount),
          discount_amount: normalizeAmount(
            sale.discount_amount
          ),
          total: normalizeAmount(sale.total),
          customer: Array.isArray(sale.customer)
            ? sale.customer[0] || null
            : sale.customer || null,
        })
      );

      const normalizedQuotes = (quotesResponse.data || []).map(
        (quote: any) => ({
          ...quote,
          subtotal: normalizeAmount(quote.subtotal),
          tax_amount: normalizeAmount(quote.tax_amount),
          discount_amount: normalizeAmount(
            quote.discount_amount
          ),
          total: normalizeAmount(quote.total),
        })
      );

      setSales(normalizedSales);
      setQuotes(normalizedQuotes);
      setCustomers(customersResponse.data || []);

      if (
        !saleCustomerId &&
        customersResponse.data &&
        customersResponse.data.length > 0
      ) {
        setSaleCustomerId(customersResponse.data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar vendas:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os dados de vendas.'
      );
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, saleCustomerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Orçamentos aceites.
   */
  const acceptedQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) => quote.status === 'accepted'
      ),
    [quotes]
  );

  /**
   * Vendas confirmadas.
   */
  const confirmedSales = useMemo(
    () =>
      sales.filter(
        (sale) => sale.status === 'confirmed'
      ),
    [sales]
  );

  /**
   * Vendas pendentes.
   */
  const pendingSales = useMemo(
    () =>
      sales.filter(
        (sale) => sale.status === 'pending'
      ),
    [sales]
  );

  /**
   * Converte sales + quotes aceites em registros
   * para exibição.
   *
   * Um orçamento aceite que já virou uma venda
   * não é contado novamente.
   */
  const allSalesRecords = useMemo<SaleRecord[]>(() => {
    const records: SaleRecord[] = [];

    const saleQuoteIds = new Set(
      sales
        .filter((sale) => sale.quote_id)
        .map((sale) => sale.quote_id)
    );

    sales.forEach((sale) => {
      records.push({
        id: `sale_${sale.id}`,
        source: 'sale',
        title: `Venda #${sale.sale_number}`,
        customer: getCustomerDisplayName(
          sale.customer
        ),
        amount: normalizeAmount(sale.total),
        date: sale.sale_date,
        status: sale.status,
        saleNumber: sale.sale_number,
        method: 'Venda',
      });
    });

    acceptedQuotes.forEach((quote) => {
      if (saleQuoteIds.has(quote.id)) {
        return;
      }

      records.push({
        id: `quote_${quote.id}`,
        source: 'quote',
        title: `Orçamento #${quote.quote_number}`,
        customer:
          quote.customer_name ||
          'Cliente Geral',
        amount: normalizeAmount(quote.total),
        date: quote.issue_date,
        status: 'accepted',
        method: 'Orçamento Adjudicado',
      });
    });

    return records.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [sales, acceptedQuotes]);

  /**
   * Filtra os registros.
   */
  const filteredRecords = useMemo(() => {
    const now = new Date();

    return allSalesRecords.filter((record) => {
      const search = searchQuery
        .trim()
        .toLowerCase();

      const matchesSearch =
        !search ||
        record.title
          .toLowerCase()
          .includes(search) ||
        record.customer
          .toLowerCase()
          .includes(search);

      if (!matchesSearch) return false;

      if (
        typeTab === 'sales' &&
        record.source !== 'sale'
      ) {
        return false;
      }

      if (
        typeTab === 'quotes' &&
        record.source !== 'quote'
      ) {
        return false;
      }

      const itemDate = new Date(record.date);

      if (periodFilter === 'month') {
        if (
          itemDate.getMonth() !== now.getMonth() ||
          itemDate.getFullYear() !==
            now.getFullYear()
        ) {
          return false;
        }
      }

      if (periodFilter === 'quarter') {
        const currentQuarter = Math.floor(
          now.getMonth() / 3
        );

        const itemQuarter = Math.floor(
          itemDate.getMonth() / 3
        );

        if (
          itemQuarter !== currentQuarter ||
          itemDate.getFullYear() !==
            now.getFullYear()
        ) {
          return false;
        }
      }

      if (periodFilter === 'year') {
        if (
          itemDate.getFullYear() !==
          now.getFullYear()
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    allSalesRecords,
    searchQuery,
    typeTab,
    periodFilter,
  ]);

  /**
   * Total confirmado.
   */
  const totalConfirmed = useMemo(
    () =>
      confirmedSales.reduce(
        (total, sale) =>
          total + normalizeAmount(sale.total),
        0
      ),
    [confirmedSales]
  );

  /**
   * Total de vendas incluindo pendentes.
   */
  const totalSalesAmount = useMemo(
    () =>
      sales.reduce(
        (total, sale) =>
          total + normalizeAmount(sale.total),
        0
      ),
    [sales]
  );

  /**
   * Ticket médio das vendas reais.
   */
  const averageTicket = useMemo(() => {
    if (sales.length === 0) return 0;

    return totalSalesAmount / sales.length;
  }, [sales.length, totalSalesAmount]);

  /**
   * Conversão de orçamento.
   */
  const conversionRate = useMemo(() => {
    if (quotes.length === 0) return 0;

    return Math.round(
      (acceptedQuotes.length /
        quotes.length) *
        100
    );
  }, [quotes.length, acceptedQuotes.length]);

  /**
   * Valor do pipeline de orçamentos enviados.
   */
  const pendingQuotesValue = useMemo(
    () =>
      quotes
        .filter(
          (quote) => quote.status === 'sent'
        )
        .reduce(
          (total, quote) =>
            total + normalizeAmount(quote.total),
          0
        ),
    [quotes]
  );

  /**
   * Criação de venda real.
   */
  const handleCreateSale = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!workspace?.id) {
      setError(
        'Workspace não encontrado.'
      );
      return;
    }

    if (!user?.id) {
      setError(
        'Utilizador autenticado não encontrado.'
      );
      return;
    }

    if (!saleAmount.trim()) {
      setError(
        'Informe o valor da venda.'
      );
      return;
    }

    const amount = Number(
      saleAmount
        .replace(/\./g, '')
        .replace(',', '.')
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        'Informe um valor de venda válido.'
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      /**
       * Gera um número de venda no frontend.
       *
       * O ideal é posteriormente transformar isto
       * em uma função PostgreSQL para garantir
       * unicidade concorrente.
       */
      const timestamp = Date.now()
        .toString()
        .slice(-8);

      const saleNumber = `V-${timestamp}`;

      const selectedCustomer =
        customers.find(
          (customer) =>
            customer.id === saleCustomerId
        );

      const customerName =
        selectedCustomer
          ? getCustomerDisplayName(
              selectedCustomer
            )
          : 'Cliente Geral';

      const { data, error: insertError } =
        await supabase
          .from('sales')
          .insert({
            workspace_id: workspace.id,
            customer_id:
              saleCustomerId || null,
            quote_id: null,
            sale_number: saleNumber,
            status: 'confirmed',
            sale_date: saleDate,
            subtotal: amount,
            tax_amount: 0,
            discount_amount: 0,
            total: amount,
            created_by: user.id,
          })
          .select()
          .single();

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      console.log(
        'Venda criada:',
        data,
        customerName,
        saleTitle,
        saleNotes
      );

      setIsNewSaleOpen(false);

      setSaleTitle('');
      setSaleAmount('');
      setSaleNotes('');

      if (customers.length > 0) {
        setSaleCustomerId(
          customers[0].id
        );
      } else {
        setSaleCustomerId('');
      }

      await loadData();
    } catch (err) {
      console.error(
        'Erro ao criar venda:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar a venda.'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Exportação CSV.
   */
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      return;
    }

    const headers = [
      'ID',
      'Origem',
      'Descrição',
      'Cliente',
      'Valor',
      'Data',
      'Estado',
      'Método',
    ]
      .map(escapeCSV)
      .join(',');

    const rows = filteredRecords
      .map((record) =>
        [
          record.id,
          record.source,
          record.title,
          record.customer,
          record.amount.toFixed(2),
          record.date,
          record.status,
          record.method || '',
        ]
          .map(escapeCSV)
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      [`\uFEFF${headers}\n${rows}`],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `stalmind-vendas-${new Date()
        .toISOString()
        .split('T')[0]}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const getStatusLabel = (
    status: SaleRecord['status']
  ) => {
    switch (status) {
      case 'confirmed':
        return 'Concluída';

      case 'pending':
        return 'Pendente';

      case 'cancelled':
        return 'Cancelada';

      case 'refunded':
        return 'Reembolsada';

      case 'accepted':
        return 'Orçamento Aceite';

      default:
        return status;
    }
  };

  const getStatusClasses = (
    status: SaleRecord['status']
  ) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';

      case 'accepted':
        return 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';

      case 'pending':
        return 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';

      case 'cancelled':
        return 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60';

      case 'refunded':
        return 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60';

      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusIcon = (
    status: SaleRecord['status']
  ) => {
    if (status === 'confirmed') {
      return (
        <CheckCircle2 className="w-2.5 h-2.5" />
      );
    }

    if (status === 'accepted') {
      return (
        <FileText className="w-2.5 h-2.5" />
      );
    }

    if (status === 'pending') {
      return (
        <Clock className="w-2.5 h-2.5" />
      );
    }

    if (status === 'cancelled') {
      return (
        <XCircle className="w-2.5 h-2.5" />
      );
    }

    return (
      <RotateCcw className="w-2.5 h-2.5" />
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />

            Vendas & Faturamento
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gerencie vendas, orçamentos aceites,
            faturamento e desempenho comercial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {filteredRecords.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />

              Exportar
            </button>
          )}

          <button
            onClick={() =>
              setIsNewSaleOpen(true)
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />

            Registar Venda
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong className="font-semibold">
                Erro
              </strong>

              <p className="mt-1">
                {error}
              </p>
            </div>

            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FATURADO */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Faturado
            </span>

            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(
              totalConfirmed,
              currencySymbol
            )}
          </h3>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {confirmedSales.length} vendas confirmadas
          </p>
        </div>

        {/* TICKET */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ticket Médio
            </span>

            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>

          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(
              averageTicket,
              currencySymbol
            )}
          </h3>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Média por venda
          </p>
        </div>

        {/* CONVERSÃO */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Conversão
            </span>

            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {conversionRate}%
          </h3>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {acceptedQuotes.length} de {quotes.length}{' '}
            orçamentos aceites
          </p>
        </div>

        {/* PIPELINE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pipeline
            </span>

            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(
              pendingQuotesValue,
              currencySymbol
            )}
          </h3>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {quotes.filter(
              (quote) =>
                quote.status === 'sent'
            ).length}{' '}
            orçamentos aguardando resposta
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* CONTROLS */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl">
            <button
              onClick={() =>
                setTypeTab('all')
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Todos ({allSalesRecords.length})
            </button>

            <button
              onClick={() =>
                setTypeTab('sales')
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'sales'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Vendas ({sales.length})
            </button>

            <button
              onClick={() =>
                setTypeTab('quotes')
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'quotes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Orçamentos Aceites (
              {acceptedQuotes.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Pesquisar venda ou cliente..."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(event) =>
                setPeriodFilter(
                  event.target.value as
                    | 'all'
                    | 'month'
                    | 'quarter'
                    | 'year'
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">
                Todo o Período
              </option>

              <option value="month">
                Este Mês
              </option>

              <option value="quarter">
                Este Trimestre
              </option>

              <option value="year">
                Este Ano
              </option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="px-5 py-3.5">
                  Descrição / Origem
                </th>

                <th className="px-5 py-3.5">
                  Cliente
                </th>

                <th className="px-5 py-3.5">
                  Data
                </th>

                <th className="px-5 py-3.5">
                  Estado
                </th>

                <th className="px-5 py-3.5 text-right">
                  Valor
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />

                    A carregar vendas...
                  </td>
                </tr>
              ) : filteredRecords.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />

                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      Nenhuma venda encontrada
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      Registe uma venda ou aceite
                      um orçamento para começar.
                    </p>

                    <button
                      onClick={() =>
                        setIsNewSaleOpen(true)
                      }
                      className="mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />

                      Registar Primeira Venda
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              item.source ===
                              'quote'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.source ===
                            'quote' ? (
                              <FileText className="w-3.5 h-3.5" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>

                            <span className="text-[10px] text-slate-400">
                              {item.source ===
                              'quote'
                                ? 'Orçamento Aprovado'
                                : 'Venda Registada'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {item.customer}
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {new Date(
                          item.date
                        ).toLocaleDateString(
                          'pt-PT',
                          {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          }
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusClasses(
                            item.status
                          )}`}
                        >
                          {getStatusIcon(
                            item.status
                          )}

                          {getStatusLabel(
                            item.status
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{' '}
                        {formatCurrency(
                          item.amount,
                          currencySymbol
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      <Modal
        isOpen={isNewSaleOpen}
        onClose={() =>
          !saving &&
          setIsNewSaleOpen(false)
        }
        title="Registar Nova Venda"
      >
        <form
          onSubmit={handleCreateSale}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Venda
            </label>

            <input
              type="text"
              placeholder="Ex.: Projeto de Consultoria"
              value={saleTitle}
              onChange={(event) =>
                setSaleTitle(
                  event.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor ({currencySymbol}) *
              </label>

              <input
                type="text"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={saleAmount}
                onChange={(event) =>
                  setSaleAmount(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data *
              </label>

              <input
                type="date"
                required
                value={saleDate}
                onChange={(event) =>
                  setSaleDate(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cliente
            </label>

            {customers.length > 0 ? (
              <select
                value={saleCustomerId}
                onChange={(event) =>
                  setSaleCustomerId(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">
                  Cliente Geral
                </option>

                {customers.map(
                  (customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                      {customer.company_name
                        ? ` (${customer.company_name})`
                        : ''}
                    </option>
                  )
                )}
              </select>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-slate-500 dark:text-slate-400">
                Nenhum cliente cadastrado.
                A venda será registada como
                Cliente Geral.
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações
            </label>

            <textarea
              rows={3}
              placeholder="Detalhes da venda..."
              value={saleNotes}
              onChange={(event) =>
                setSaleNotes(
                  event.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                setIsNewSaleOpen(false)
              }
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}

              {saving
                ? 'A guardar...'
                : 'Guardar Venda'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SalesPage;
