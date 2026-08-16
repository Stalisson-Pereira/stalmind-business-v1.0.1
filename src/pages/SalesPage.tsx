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
  AlertCircle,
  Users,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { quoteService } from '../services/quoteService';
import { financialService } from '../services/financialService';
import { customerService } from '../services/customerService';

import { Quote, FinancialTransaction, Customer } from '../types';
import { Modal } from '../components/common/Modal';

interface SalesPageProps {
  onNavigate?: (path: string, action?: string) => void;
}

type PeriodFilter = 'all' | 'month' | 'quarter' | 'year';

type TypeTab = 'all' | 'income' | 'quotes_accepted';

type SaleStatus = 'Concluído' | 'Aceite' | 'Pendente';

interface SaleRecord {
  id: string;
  source: 'quote' | 'direct';
  title: string;
  customer: string;
  amount: number;
  date: string;
  status: SaleStatus;
  method?: string;
  reference?: string;
}

const getLocalDateString = (): string => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseAmount = (value: string): number => {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  return Number(normalized);
};

const escapeCSV = (value: string): string => {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
};

const formatCurrency = (amount: number, currencySymbol: string): string => {
  return `${currencySymbol} ${amount.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const isDateInPeriod = (
  dateString: string,
  period: PeriodFilter
): boolean => {
  if (period === 'all') {
    return true;
  }

  const itemDate = new Date(`${dateString}T12:00:00`);
  const now = new Date();

  if (Number.isNaN(itemDate.getTime())) {
    return false;
  }

  if (period === 'month') {
    return (
      itemDate.getMonth() === now.getMonth() &&
      itemDate.getFullYear() === now.getFullYear()
    );
  }

  if (period === 'quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const itemQuarter = Math.floor(itemDate.getMonth() / 3);

    return (
      itemQuarter === currentQuarter &&
      itemDate.getFullYear() === now.getFullYear()
    );
  }

  if (period === 'year') {
    return itemDate.getFullYear() === now.getFullYear();
  }

  return true;
};

export const SalesPage: React.FC<SalesPageProps> = ({
  onNavigate,
}) => {
  const { workspace } = useAuth();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(
    []
  );
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] =
    useState<PeriodFilter>('all');
  const [typeTab, setTypeTab] = useState<TypeTab>('all');

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const [saleTitle, setSaleTitle] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleDate, setSaleDate] = useState(getLocalDateString());
  const [salePaymentMethod, setSalePaymentMethod] = useState(
    'Transferência Bancária'
  );
  const [saleNotes, setSaleNotes] = useState('');

  const currencySymbol =
    workspace?.currency === 'BRL'
      ? 'R$'
      : workspace?.currency === 'USD'
        ? '$'
        : '€';

  const loadData = useCallback(async () => {
    if (!workspace?.id) {
      setQuotes([]);
      setTransactions([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loadedQuotes, loadedTransactions, loadedCustomers] =
        await Promise.all([
          quoteService.getQuotes(workspace.id),
          financialService.getTransactions(workspace.id),
          customerService.getCustomers(workspace.id),
        ]);

      setQuotes(Array.isArray(loadedQuotes) ? loadedQuotes : []);
      setTransactions(
        Array.isArray(loadedTransactions)
          ? loadedTransactions
          : []
      );
      setCustomers(
        Array.isArray(loadedCustomers) ? loadedCustomers : []
      );
    } catch (err) {
      console.error('Erro ao carregar dados de vendas:', err);

      setError(
        'Não foi possível carregar os dados de vendas. Verifique a ligação ao banco de dados e tente novamente.'
      );

      setQuotes([]);
      setTransactions([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const acceptedQuotes = useMemo(() => {
    return quotes.filter((quote) => quote.status === 'accepted');
  }, [quotes]);

  const incomeTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) => transaction.type === 'income'
    );
  }, [transactions]);

  /**
   * IDs/referências dos orçamentos que já deram origem
   * a uma receita financeira.
   *
   * Isto evita apresentar o mesmo negócio duas vezes.
   */
  const incomeQuoteReferences = useMemo(() => {
    const references = new Set<string>();

    incomeTransactions.forEach((transaction) => {
      const text = [
        transaction.title,
        transaction.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      quotes.forEach((quote) => {
        const quoteNumber = String(
          quote.quoteNumber ?? ''
        ).toLowerCase();

        if (
          quoteNumber &&
          text.includes(quoteNumber)
        ) {
          references.add(String(quote.id));
        }
      });
    });

    return references;
  }, [incomeTransactions, quotes]);

  /**
   * Registos exibidos na tabela.
   *
   * IMPORTANTE:
   * - Receita financeira = faturamento.
   * - Orçamento aceite = venda ganha/pipeline comercial,
   *   mas não é contabilizado como faturamento se não existir
   *   uma receita financeira correspondente.
   */
  const allSalesRecords = useMemo<SaleRecord[]>(() => {
    const records: SaleRecord[] = [];

    incomeTransactions.forEach((transaction) => {
      records.push({
        id: `tx_${transaction.id}`,
        source: 'direct',
        title: transaction.title || 'Venda',
        customer:
          transaction.customerOrSupplier ||
          'Cliente Geral',
        amount: Number(transaction.amount) || 0,
        date: transaction.date,
        status:
          transaction.status === 'paid'
            ? 'Concluído'
            : 'Pendente',
        method: transaction.paymentMethod,
      });
    });

    acceptedQuotes.forEach((quote) => {
      if (incomeQuoteReferences.has(String(quote.id))) {
        return;
      }

      records.push({
        id: `qt_${quote.id}`,
        source: 'quote',
        title: `Orçamento #${quote.quoteNumber}`,
        customer:
          quote.customerName || 'Cliente Geral',
        amount: Number(quote.total) || 0,
        date: quote.createdAt
          ? quote.createdAt.split('T')[0]
          : getLocalDateString(),
        status: 'Aceite',
        method: 'Orçamento Adjudicado',
        reference: String(quote.quoteNumber),
      });
    });

    return records.sort((a, b) => {
      return (
        new Date(`${b.date}T12:00:00`).getTime() -
        new Date(`${a.date}T12:00:00`).getTime()
      );
    });
  }, [
    incomeTransactions,
    acceptedQuotes,
    incomeQuoteReferences,
  ]);

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allSalesRecords.filter((record) => {
      const matchesSearch =
        !query ||
        record.title.toLowerCase().includes(query) ||
        record.customer.toLowerCase().includes(query) ||
        record.method?.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (
        typeTab === 'income' &&
        record.source !== 'direct'
      ) {
        return false;
      }

      if (
        typeTab === 'quotes_accepted' &&
        record.source !== 'quote'
      ) {
        return false;
      }

      if (!isDateInPeriod(record.date, periodFilter)) {
        return false;
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
   * Faturamento real:
   * somente transações financeiras pagas.
   */
  const paidSalesAmount = useMemo(() => {
    return incomeTransactions
      .filter(
        (transaction) => transaction.status === 'paid'
      )
      .reduce(
        (total, transaction) =>
          total + (Number(transaction.amount) || 0),
        0
      );
  }, [incomeTransactions]);

  /**
   * Total do período selecionado.
   */
  const periodPaidSalesAmount = useMemo(() => {
    return incomeTransactions
      .filter(
        (transaction) =>
          transaction.status === 'paid' &&
          isDateInPeriod(
            transaction.date,
            periodFilter
          )
      )
      .reduce(
        (total, transaction) =>
          total + (Number(transaction.amount) || 0),
        0
      );
  }, [incomeTransactions, periodFilter]);

  const paidTransactionCount = useMemo(() => {
    return incomeTransactions.filter(
      (transaction) =>
        transaction.status === 'paid'
    ).length;
  }, [incomeTransactions]);

  const averageTicket = useMemo(() => {
    if (paidTransactionCount === 0) {
      return 0;
    }

    return paidSalesAmount / paidTransactionCount;
  }, [paidSalesAmount, paidTransactionCount]);

  const conversionRate = useMemo(() => {
    if (quotes.length === 0) {
      return 0;
    }

    return Math.round(
      (acceptedQuotes.length / quotes.length) * 100
    );
  }, [quotes.length, acceptedQuotes.length]);

  const pendingQuotesCount = useMemo(() => {
    return quotes.filter(
      (quote) =>
        quote.status === 'sent' ||
        quote.status === 'pending'
    ).length;
  }, [quotes]);

  const pendingQuotesValue = useMemo(() => {
    return quotes
      .filter(
        (quote) =>
          quote.status === 'sent' ||
          quote.status === 'pending'
      )
      .reduce(
        (total, quote) =>
          total + (Number(quote.total) || 0),
        0
      );
  }, [quotes]);

  const openNewSaleModal = () => {
    setError(null);
    setSaleTitle('');
    setSaleAmount('');
    setSaleDate(getLocalDateString());
    setSaleNotes('');
    setSalePaymentMethod(
      'Transferência Bancária'
    );

    if (customers.length > 0) {
      setSaleCustomer(customers[0].name);
    } else {
      setSaleCustomer('');
    }

    setIsNewSaleOpen(true);
  };

  const closeNewSaleModal = () => {
    if (saving) {
      return;
    }

    setIsNewSaleOpen(false);
  };

  const handleCreateDirectSale = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!workspace?.id) {
      setError(
        'Workspace não encontrado. Faça login novamente.'
      );
      return;
    }

    if (!saleTitle.trim()) {
      setError('Informe o título da venda.');
      return;
    }

    const numericAmount = parseAmount(saleAmount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError('Informe um valor de venda válido.');
      return;
    }

    if (!saleDate) {
      setError('Informe a data da venda.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await financialService.addTransaction({
        workspaceId: workspace.id,
        type: 'income',
        title: saleTitle.trim(),
        amount: numericAmount,
        category: 'Vendas & Serviços',
        status: 'paid',
        date: saleDate,
        customerOrSupplier:
          saleCustomer.trim() || 'Cliente Geral',
        paymentMethod: salePaymentMethod,
        notes: saleNotes.trim(),
      });

      setIsNewSaleOpen(false);

      setSaleTitle('');
      setSaleAmount('');
      setSaleCustomer('');
      setSaleDate(getLocalDateString());
      setSalePaymentMethod(
        'Transferência Bancária'
      );
      setSaleNotes('');

      await loadData();
    } catch (err) {
      console.error('Erro ao registar venda:', err);

      setError(
        'Não foi possível registar a venda. Verifique os dados e as permissões do workspace.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      return;
    }

    const headers = [
      'ID',
      'Titulo',
      'Cliente',
      'Valor',
      'Data',
      'Status',
      'Metodo',
      'Origem',
    ];

    const rows = filteredRecords.map((record) => [
      record.id,
      record.title,
      record.customer,
      record.amount.toFixed(2),
      record.date,
      record.status,
      record.method || '',
      record.source === 'quote'
        ? 'Orçamento'
        : 'Venda Direta',
    ]);

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) =>
        row.map(escapeCSV).join(',')
      ),
    ].join('\n');

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `vendas_stalmind_${getLocalDateString()}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-500" />

          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Workspace não encontrado
          </h2>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Não foi possível identificar o workspace atual.
          </p>
        </div>
      </div>
    );
  }

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
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Atualizar dados"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading ? 'animate-spin' : ''
              }`}
            />
          </button>

          {filteredRecords.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
            </button>
          )}

          <button
            type="button"
            onClick={openNewSaleModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Registar Venda
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          <div className="flex-1">
            <p className="text-xs font-semibold">
              Ocorreu um problema
            </p>

            <p className="text-xs mt-1">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FATURAMENTO */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Faturado
            </span>

            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(
                paidSalesAmount,
                currencySymbol
              )}
            </h3>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {paidTransactionCount} vendas pagas
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

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(
                averageTicket,
                currencySymbol
              )}
            </h3>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Média por venda paga
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

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {conversionRate}%
            </h3>
          </div>

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

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(
                pendingQuotesValue,
                currencySymbol
              )}
            </h3>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {pendingQuotesCount} orçamento(s) pendente(s)
          </p>
        </div>
      </div>

      {/* PERIOD SUMMARY */}
      {periodFilter !== 'all' && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                Faturamento do período
              </p>

              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-0.5">
                Apenas transações financeiras marcadas como pagas.
              </p>
            </div>

            <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
              {formatCurrency(
                periodPaidSalesAmount,
                currencySymbol
              )}
            </span>
          </div>
        </div>
      )}

      {/* TABLE CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* CONTROLS */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setTypeTab('all')}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas ({allSalesRecords.length})
            </button>

            <button
              type="button"
              onClick={() => setTypeTab('income')}
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'income'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Receitas ({incomeTransactions.length})
            </button>

            <button
              type="button"
              onClick={() =>
                setTypeTab('quotes_accepted')
              }
              className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                typeTab === 'quotes_accepted'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Orçamentos Aceites ({acceptedQuotes.length})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Pesquisar venda ou cliente..."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(event) =>
                setPeriodFilter(
                  event.target.value as PeriodFilter
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
                  Método
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
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />

                    A carregar registos de vendas...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />

                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      Nenhum registo encontrado
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      Registe uma nova venda ou aceite um
                      orçamento para começar a alimentar o
                      módulo comercial.
                    </p>

                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <button
                        type="button"
                        onClick={openNewSaleModal}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Registar Venda
                      </button>

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('/customers', 'new')
                          }
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs inline-flex items-center gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Criar Cliente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            item.source === 'quote'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.source === 'quote' ? (
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
                            {item.source === 'quote'
                              ? 'Orçamento aprovado'
                              : 'Faturamento direto'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {item.customer}
                    </td>

                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {new Date(
                        `${item.date}T12:00:00`
                      ).toLocaleDateString('pt-PT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {item.method || '—'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Concluído'
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                            : item.status === 'Aceite'
                              ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                        }`}
                      >
                        {item.status === 'Concluído' && (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        )}

                        {item.status === 'Aceite' && (
                          <FileText className="w-2.5 h-2.5" />
                        )}

                        {item.status === 'Pendente' && (
                          <Clock className="w-2.5 h-2.5" />
                        )}

                        {item.status}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      <Modal
        isOpen={isNewSaleOpen}
        onClose={closeNewSaleModal}
        title="Registar Nova Venda"
      >
        <form
          onSubmit={handleCreateDirectSale}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título da Venda / Serviço *
            </label>

            <input
              type="text"
              required
              maxLength={200}
              placeholder="Ex.: Projeto de Consultoria"
              value={saleTitle}
              onChange={(event) =>
                setSaleTitle(event.target.value)
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
                inputMode="decimal"
                required
                placeholder="0,00"
                value={saleAmount}
                onChange={(event) =>
                  setSaleAmount(event.target.value)
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
                  setSaleDate(event.target.value)
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
                value={saleCustomer}
                onChange={(event) =>
                  setSaleCustomer(event.target.value)
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.name}
                  >
                    {customer.name}
                    {'company' in customer &&
                    customer.company
                      ? ` (${customer.company})`
                      : ''}
                  </option>
                ))}

                <option value="Cliente Geral">
                  Outro / Cliente Avulso
                </option>
              </select>
            ) : (
              <input
                type="text"
                maxLength={200}
                placeholder="Nome do cliente ou empresa"
                value={saleCustomer}
                onChange={(event) =>
                  setSaleCustomer(event.target.value)
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Forma de Pagamento
            </label>

            <select
              value={salePaymentMethod}
              onChange={(event) =>
                setSalePaymentMethod(
                  event.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Transferência Bancária">
                Transferência Bancária
              </option>

              <option value="MB WAY">
                MB WAY
              </option>

              <option value="Multibanco">
                Multibanco
              </option>

              <option value="Cartão de Crédito">
                Cartão de Crédito
              </option>

              <option value="Numerário / Dinheiro">
                Numerário / Dinheiro
              </option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas Adicionais
            </label>

            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Detalhes ou condições da venda..."
              value={saleNotes}
              onChange={(event) =>
                setSaleNotes(event.target.value)
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={saving}
              onClick={closeNewSaleModal}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && (
                <Loader2 className="w-4 h-4 animate-spin" />
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
