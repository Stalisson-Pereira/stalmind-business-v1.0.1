import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  UserRound,
  XCircle,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/common/Modal';
import { saleService, Sale } from '../services/saleService';
import { supabase } from '../lib/supabaseClient';

interface SalesPageProps {
  onNavigate?: (path: string, action?: string) => void;
}

interface CustomerRecord {
  id: string;
  name: string;
  company_name?: string | null;
  company?: string | null;
  email?: string | null;
  tax_id?: string | null;
}

interface QuoteRecord {
  id: string;
  quote_number: string;
  status:
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'cancelled';
  total: number;
  issue_date: string;
  customer_id: string | null;
  customer_name?: string | null;
}

type PeriodFilter = 'all' | 'month' | 'quarter' | 'year';

type SaleDisplayRecord = {
  id: string;
  source: 'sale';
  title: string;
  customer: string;
  amount: number;
  date: string;
  status: Sale['status'];
  saleNumber: string;
};

type QuoteDisplayRecord = {
  id: string;
  source: 'quote';
  title: string;
  customer: string;
  amount: number;
  date: string;
  status: 'accepted';
  saleNumber: string;
};

type DisplayRecord = SaleDisplayRecord | QuoteDisplayRecord;

const formatCurrency = (value: number, currency: string) => {
  const locale = currency === 'BRL' ? 'pt-BR' : 'pt-PT';

  const symbol =
    currency === 'BRL'
      ? 'R$'
      : currency === 'USD'
        ? '$'
        : '€';

  return `${symbol} ${value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getTodayInputValue = () => {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, '0');

  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getSaleStatusLabel = (status: Sale['status']) => {
  switch (status) {
    case 'confirmed':
      return 'Concluída';

    case 'pending':
      return 'Pendente';

    case 'cancelled':
      return 'Cancelada';

    case 'refunded':
      return 'Reembolsada';

    default:
      return status;
  }
};

const getSaleStatusClass = (status: Sale['status']) => {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';

    case 'pending':
      return 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';

    case 'cancelled':
      return 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';

    case 'refunded':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

export const SalesPage: React.FC<SalesPageProps> = ({ onNavigate }) => {
  const { user, workspace } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [periodFilter, setPeriodFilter] =
    useState<PeriodFilter>('all');

  const [typeTab, setTypeTab] = useState<
    'all' | 'sales' | 'quotes'
  >('all');

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const [saleDescription, setSaleDescription] = useState('');

  const [saleAmount, setSaleAmount] = useState('');

  const [saleQuantity, setSaleQuantity] = useState('1');

  const [saleTaxRate, setSaleTaxRate] = useState('0');

  const [saleDiscount, setSaleDiscount] = useState('0');

  const [saleCustomerId, setSaleCustomerId] = useState('');

  const [saleDate, setSaleDate] =
    useState(getTodayInputValue());

  const [saleStatus, setSaleStatus] =
    useState<Sale['status']>('confirmed');

  const currency = workspace?.currency || 'EUR';

  const loadData = async () => {
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
        salesData,
        customersResponse,
        quotesResponse,
      ] = await Promise.all([
        saleService.getSales(workspace.id),

        supabase
          .from('customers')
          .select(
            'id,name,company_name,company,email,tax_id'
          )
          .eq('workspace_id', workspace.id)
          .eq('is_active', true)
          .order('name', { ascending: true }),

        supabase
          .from('quotes')
          .select(
            'id,quote_number,status,total,issue_date,customer_id,customer_name'
          )
          .eq('workspace_id', workspace.id)
          .order('issue_date', { ascending: false }),
      ]);

      if (customersResponse.error) {
        throw new Error(
          `Não foi possível carregar os clientes: ${customersResponse.error.message}`
        );
      }

      if (quotesResponse.error) {
        throw new Error(
          `Não foi possível carregar os orçamentos: ${quotesResponse.error.message}`
        );
      }

      setSales(salesData);

      setCustomers(
        (customersResponse.data ?? []) as CustomerRecord[]
      );

      setQuotes(
        (quotesResponse.data ?? []) as QuoteRecord[]
      );
    } catch (err) {
      console.error('[SalesPage.loadData]', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o módulo de vendas.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id]);

  const customerMap = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer,
      ])
    );
  }, [customers]);

  const getCustomerName = (
    customerId: string | null | undefined,
    fallback?: string | null
  ) => {
    if (fallback?.trim()) {
      return fallback.trim();
    }

    if (!customerId) {
      return 'Cliente Geral';
    }

    const customer = customerMap.get(customerId);

    if (!customer) {
      return 'Cliente Geral';
    }

    return (
      customer.company_name ||
      customer.company ||
      customer.name ||
      'Cliente Geral'
    );
  };

  const confirmedSales = useMemo(
    () =>
      sales.filter(
        (sale) => sale.status === 'confirmed'
      ),
    [sales]
  );

  const pendingSales = useMemo(
    () =>
      sales.filter(
        (sale) => sale.status === 'pending'
      ),
    [sales]
  );

  const acceptedQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) => quote.status === 'accepted'
      ),
    [quotes]
  );

  const pendingQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) => quote.status === 'sent'
      ),
    [quotes]
  );

  const totalSalesAmount = useMemo(() => {
    return confirmedSales.reduce(
      (total, sale) => total + Number(sale.total || 0),
      0
    );
  }, [confirmedSales]);

  const averageTicket = useMemo(() => {
    if (!confirmedSales.length) {
      return 0;
    }

    return totalSalesAmount / confirmedSales.length;
  }, [confirmedSales.length, totalSalesAmount]);

  const conversionRate = useMemo(() => {
    if (!quotes.length) {
      return 0;
    }

    return Math.round(
      (acceptedQuotes.length / quotes.length) * 100
    );
  }, [quotes.length, acceptedQuotes.length]);

  const pipelineValue = useMemo(() => {
    return pendingQuotes.reduce(
      (total, quote) => total + Number(quote.total || 0),
      0
    );
  }, [pendingQuotes]);

  const allRecords = useMemo<DisplayRecord[]>(() => {
    const records: DisplayRecord[] = [];

    sales.forEach((sale) => {
      records.push({
        id: `sale_${sale.id}`,
        source: 'sale',
        title: `Venda #${sale.sale_number}`,
        customer: getCustomerName(sale.customer_id),
        amount: Number(sale.total || 0),
        date: sale.sale_date,
        status: sale.status,
        saleNumber: sale.sale_number,
      });
    });

    acceptedQuotes.forEach((quote) => {
      const alreadyConverted = sales.some(
        (sale) => sale.quote_id === quote.id
      );

      if (!alreadyConverted) {
        records.push({
          id: `quote_${quote.id}`,
          source: 'quote',
          title: `Orçamento #${quote.quote_number}`,
          customer: getCustomerName(
            quote.customer_id,
            quote.customer_name
          ),
          amount: Number(quote.total || 0),
          date: quote.issue_date,
          status: 'accepted',
          saleNumber: '',
        });
      }
    });

    return records.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [sales, acceptedQuotes, customerMap]);

  const filteredRecords = useMemo(() => {
    const now = new Date();

    return allRecords.filter((record) => {
      const search = searchQuery
        .trim()
        .toLowerCase();

      const matchesSearch =
        !search ||
        record.title.toLowerCase().includes(search) ||
        record.customer.toLowerCase().includes(search);

      if (!matchesSearch) {
        return false;
      }

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

      const recordDate = new Date(record.date);

      if (periodFilter === 'month') {
        if (
          recordDate.getMonth() !== now.getMonth() ||
          recordDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      }

      if (periodFilter === 'quarter') {
        const currentQuarter = Math.floor(
          now.getMonth() / 3
        );

        const recordQuarter = Math.floor(
          recordDate.getMonth() / 3
        );

        if (
          currentQuarter !== recordQuarter ||
          recordDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      }

      if (periodFilter === 'year') {
        if (
          recordDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    allRecords,
    searchQuery,
    typeTab,
    periodFilter,
  ]);

  const resetSaleForm = () => {
    setSaleDescription('');
    setSaleAmount('');
    setSaleQuantity('1');
    setSaleTaxRate('0');
    setSaleDiscount('0');
    setSaleCustomerId('');
    setSaleDate(getTodayInputValue());
    setSaleStatus('confirmed');
  };

  const handleCloseSaleModal = () => {
    if (saving) {
      return;
    }

    setIsNewSaleOpen(false);
    resetSaleForm();
  };

  const handleCreateSale = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!workspace?.id) {
      setError('Workspace não identificado.');
      return;
    }

    const amount = Number(
      saleAmount.replace(',', '.')
    );

    const quantity = Number(
      saleQuantity.replace(',', '.')
    );

    const taxRate = Number(
      saleTaxRate.replace(',', '.')
    );

    const discount = Number(
      saleDiscount.replace(',', '.')
    );

    if (!saleDescription.trim()) {
      setError(
        'Informe a descrição da venda.'
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        'Informe um valor de venda válido.'
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(
        'Informe uma quantidade válida.'
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saleService.createSale({
        workspaceId: workspace.id,
        customerId:
          saleCustomerId || null,
        description: saleDescription,
        quantity,
        unitPrice: amount,
        taxRate,
        discount,
        saleDate,
        status: saleStatus,
        userId: user?.id || null,
      });

      handleCloseSaleModal();

      await loadData();
    } catch (err) {
      console.error(
        '[SalesPage.handleCreateSale]',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível registar a venda.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredRecords.length) {
      return;
    }

    const escapeCSV = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const header = [
      'ID',
      'Origem',
      'Descrição',
      'Cliente',
      'Data',
      'Estado',
      'Valor',
    ]
      .map(escapeCSV)
      .join(',');

    const rows = filteredRecords.map(
      (record) => {
        const status =
          record.source === 'sale'
            ? getSaleStatusLabel(record.status)
            : 'Orçamento Aceite';

        return [
          record.id,
          record.source === 'sale'
            ? 'Venda'
            : 'Orçamento',
          record.title,
          record.customer,
          new Date(
            record.date
          ).toLocaleDateString('pt-PT'),
          status,
          record.amount.toFixed(2),
        ]
          .map((value) =>
            escapeCSV(String(value))
          )
          .join(',');
      }
    );

    const csv =
      '\uFEFF' +
      [header, ...rows].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `stalmind-vendas-${getTodayInputValue()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const renderStatus = (
    record: DisplayRecord
  ) => {
    if (record.source === 'quote') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
          <FileText className="w-2.5 h-2.5" />
          Orçamento Aceite
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${getSaleStatusClass(
          record.status
        )}`}
      >
        {record.status === 'confirmed' && (
          <CheckCircle2 className="w-2.5 h-2.5" />
        )}

        {record.status === 'pending' && (
          <Clock className="w-2.5 h-2.5" />
        )}

        {record.status === 'cancelled' && (
          <XCircle className="w-2.5 h-2.5" />
        )}

        {record.status === 'refunded' && (
          <ArrowDownRight className="w-2.5 h-2.5" />
        )}

        {getSaleStatusLabel(record.status)}
      </span>
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
            Acompanhe receitas, vendas realizadas,
            orçamentos aceites e performance comercial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            title="Atualizar"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>

          {filteredRecords.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
          )}

          <button
            onClick={() =>
              setIsNewSaleOpen(true)
            }
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Registar Venda
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />

          <div className="min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              Não foi possível concluir a operação
            </p>

            <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5 break-words">
              {error}
            </p>
          </div>

          <button
            onClick={() => setError(null)}
            className="ml-auto text-rose-400 hover:text-rose-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Faturado
            </span>

            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(
              totalSalesAmount,
              currency
            )}
          </h3>

          <p className="text-[11px] text-slate-400 mt-1">
            {confirmedSales.length}{' '}
            venda(s) confirmada(s)
          </p>
        </div>

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
              currency
            )}
          </h3>

          <p className="text-[11px] text-slate-400 mt-1">
            Média por venda confirmada
          </p>
        </div>

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

          <p className="text-[11px] text-slate-400 mt-1">
            {acceptedQuotes.length} de{' '}
            {quotes.length} orçamento(s) aceites
          </p>
        </div>

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
              pipelineValue,
              currency
            )}
          </h3>

          <p className="text-[11px] text-slate-400 mt-1">
            {pendingQuotes.length} orçamento(s)
            pendente(s)
          </p>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
            <button
              onClick={() =>
                setTypeTab('all')
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                typeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Todas ({allRecords.length})
            </button>

            <button
              onClick={() =>
                setTypeTab('sales')
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                typeTab === 'quotes'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Orçamentos Aceites (
              {acceptedQuotes.length}
              )
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-64">
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
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(event) =>
                setPeriodFilter(
                  event.target
                    .value as PeriodFilter
                )
              }
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">
                Todo o período
              </option>

              <option value="month">
                Este mês
              </option>

              <option value="quarter">
                Este trimestre
              </option>

              <option value="year">
                Este ano
              </option>
            </select>
          </div>
        </div>

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
                    className="px-5 py-16 text-center"
                  >
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3 text-indigo-500" />

                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      A carregar vendas...
                    </p>
                  </td>
                </tr>
              ) : filteredRecords.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center"
                  >
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-25 text-slate-400" />

                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum registo encontrado
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      Registe uma venda ou aprove
                      um orçamento para começar.
                    </p>

                    <button
                      onClick={() =>
                        setIsNewSaleOpen(true)
                      }
                      className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registar Primeira Venda
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(
                  (record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              record.source ===
                              'quote'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {record.source ===
                            'quote' ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <CreditCard className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {record.title}
                            </p>

                            <span className="text-[10px] text-slate-400">
                              {record.source ===
                              'quote'
                                ? 'Orçamento aceite'
                                : 'Venda registada'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-700 dark:text-slate-300 font-medium">
                        <div className="flex items-center gap-2">
                          <UserRound className="w-3.5 h-3.5 text-slate-400" />

                          {record.customer}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(
                          record.date
                        ).toLocaleDateString(
                          'pt-PT',
                          {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          }
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {renderStatus(record)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span
                          className={`font-mono font-bold ${
                            record.source ===
                            'sale'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {formatCurrency(
                            record.amount,
                            currency
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOVA VENDA */}
      <Modal
        isOpen={isNewSaleOpen}
        onClose={
          handleCloseSaleModal
        }
        title="Registar Nova Venda"
      >
        <form
          onSubmit={handleCreateSale}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Venda *
            </label>

            <input
              type="text"
              required
              value={saleDescription}
              onChange={(event) =>
                setSaleDescription(
                  event.target.value
                )
              }
              placeholder="Ex.: Consultoria, desenvolvimento, produto..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Unitário *
              </label>

              <input
                type="text"
                inputMode="decimal"
                required
                value={saleAmount}
                onChange={(event) =>
                  setSaleAmount(
                    event.target.value
                  )
                }
                placeholder="0,00"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantidade
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={saleQuantity}
                onChange={(event) =>
                  setSaleQuantity(
                    event.target.value
                  )
                }
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                IVA (%)
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={saleTaxRate}
                onChange={(event) =>
                  setSaleTaxRate(
                    event.target.value
                  )
                }
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Desconto
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={saleDiscount}
                onChange={(event) =>
                  setSaleDiscount(
                    event.target.value
                  )
                }
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data
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
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cliente
            </label>

            <select
              value={saleCustomerId}
              onChange={(event) =>
                setSaleCustomerId(
                  event.target.value
                )
              }
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                Cliente Geral / Avulso
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                    {(
                      customer.company_name ||
                      customer.company
                    )
                      ? ` — ${
                          customer.company_name ||
                          customer.company
                        }`
                      : ''}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Estado
            </label>

            <select
              value={saleStatus}
              onChange={(event) =>
                setSaleStatus(
                  event.target
                    .value as Sale['status']
                )
              }
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="confirmed">
                Confirmada
              </option>

              <option value="pending">
                Pendente
              </option>
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              A venda será criada em{' '}
              <strong>sales</strong> e o respetivo
              item em <strong>sale_items</strong>.
              Não será utilizada a tabela
              <strong> financial_transactions</strong>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={
                handleCloseSaleModal
              }
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar Venda
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
