import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Users,
  PieChart,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Award,
  ChevronRight,
  Percent,
  FileSpreadsheet,
  FileText,
  Loader2,
  X,
  Receipt,
  Wallet,
  CircleDollarSign,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useAuth } from '../contexts/AuthContext';
import {
  supabase,
} from '../lib/supabaseClient';

interface ReportsPageProps {
  onNavigate?: (path: string) => void;
}

type Timeframe =
  | 'all'
  | 'year'
  | 'quarter'
  | 'month';

interface SaleRecord {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  quote_id?: string | null;
  sale_number?: string | null;
  status?: string | null;
  sale_date?: string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  discount_amount?: number | string | null;
  total?: number | string | null;
  created_at?: string | null;
}

interface PaymentRecord {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  sale_id?: string | null;
  invoice_id?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  status?: string | null;
  payment_date?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface ExpenseRecord {
  id: string;
  workspace_id: string;
  description?: string | null;
  category?: string | null;
  amount?: number | string | null;
  expense_date?: string | null;
  payment_method?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface InvoiceRecord {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  invoice_number?: string | null;
  status?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  total?: number | string | null;
  amount_paid?: number | string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface QuoteRecord {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  quote_number?: string | null;
  status?: string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  issue_date?: string | null;
  quote_date?: string | null;
  date?: string | null;
  created_at?: string | null;
}

interface CustomerRecord {
  id: string;
  workspace_id: string;
  name?: string | null;
  company?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface MonthlyData {
  month: string;
  year: number;
  income: number;
  payments: number;
  expense: number;
}

interface TopCustomer {
  id: string;
  name: string;
  count: number;
  total: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface InvoiceSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalValue: number;
  paidValue: number;
  pendingValue: number;
}

const MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const getFlexibleDate = (
  value: unknown
): Date | null => {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getNumber = (
  value: unknown
): number => {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
};

const formatAmount = (
  amount: number,
  currencySymbol: string
) => {
  return `${currencySymbol} ${getNumber(
    amount
  ).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (
  value: unknown
) => {
  const date =
    getFlexibleDate(value);

  if (!date) {
    return '-';
  }

  return date.toLocaleDateString(
    'pt-PT'
  );
};

const getQuoteDate = (
  quote: QuoteRecord
): Date | null => {
  return getFlexibleDate(
    quote.issue_date ??
      quote.quote_date ??
      quote.date ??
      quote.created_at
  );
};

const getCustomerName = (
  customer?: CustomerRecord
) => {
  if (!customer) {
    return 'Cliente Geral';
  }

  return (
    customer.name ||
    customer.company_name ||
    customer.company ||
    'Cliente Geral'
  );
};

const csvEscape = (
  value: unknown
) => {
  const text = String(
    value ?? ''
  );

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
};

export const ReportsPage: React.FC<
  ReportsPageProps
> = ({ onNavigate }) => {
  const { workspace } =
    useAuth();

  const [sales, setSales] =
    useState<SaleRecord[]>([]);

  const [payments, setPayments] =
    useState<PaymentRecord[]>([]);

  const [expenses, setExpenses] =
    useState<ExpenseRecord[]>([]);

  const [invoices, setInvoices] =
    useState<InvoiceRecord[]>([]);

  const [quotes, setQuotes] =
    useState<QuoteRecord[]>([]);

  const [customers, setCustomers] =
    useState<CustomerRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false);

  const exportMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [timeframe, setTimeframe] =
    useState<Timeframe>('year');

  const currencySymbol =
    workspace?.currency === 'BRL'
      ? 'R$'
      : workspace?.currency === 'USD'
        ? '$'
        : '€';

  /*
   * ============================================================
   * CARREGAMENTO
   *
   * FONTE FINANCEIRA ATUAL:
   *
   * sales
   * payments
   * expenses
   * invoices
   *
   * NÃO EXISTE:
   *
   * financial_transactions
   * financialService
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      const workspaceId =
        workspace?.id;

      if (!workspaceId) {
        if (mounted) {
          setLoading(false);
        }

        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        /*
         * ========================================================
         * DADOS FINANCEIROS
         * ========================================================
         */

        const [
          {
            data: salesData,
            error: salesError,
          },
          {
            data: paymentsData,
            error: paymentsError,
          },
          {
            data: expensesData,
            error: expensesError,
          },
          {
            data: invoicesData,
            error: invoicesError,
          },
        ] = await Promise.all([
          supabase
            .from('sales')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'sale_date',
              {
                ascending: false,
              }
            ),

          supabase
            .from('payments')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'payment_date',
              {
                ascending: false,
              }
            ),

          supabase
            .from('expenses')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'expense_date',
              {
                ascending: false,
              }
            ),

          supabase
            .from('invoices')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'issue_date',
              {
                ascending: false,
              }
            ),
        ]);

        if (salesError) {
          console.error(
            '[ReportsPage] Erro ao carregar vendas:',
            salesError
          );
        }

        if (paymentsError) {
          console.error(
            '[ReportsPage] Erro ao carregar pagamentos:',
            paymentsError
          );
        }

        if (expensesError) {
          console.error(
            '[ReportsPage] Erro ao carregar despesas:',
            expensesError
          );
        }

        if (invoicesError) {
          console.error(
            '[ReportsPage] Erro ao carregar faturas:',
            invoicesError
          );
        }

        /*
         * ========================================================
         * ORÇAMENTOS E CLIENTES
         *
         * São carregados separadamente para não impedir os
         * relatórios financeiros caso uma dessas fontes falhe.
         * ========================================================
         */

        const [
          quotesResult,
          customersResult,
        ] = await Promise.all([
          supabase
            .from('quotes')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),

          supabase
            .from('customers')
            .select('*')
            .eq(
              'workspace_id',
              workspaceId
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            ),
        ]);

        if (quotesResult.error) {
          console.error(
            '[ReportsPage] Erro ao carregar orçamentos:',
            quotesResult.error
          );
        }

        if (customersResult.error) {
          console.error(
            '[ReportsPage] Erro ao carregar clientes:',
            customersResult.error
          );
        }

        if (!mounted) {
          return;
        }

        setSales(
          Array.isArray(salesData)
            ? (salesData as SaleRecord[])
            : []
        );

        setPayments(
          Array.isArray(paymentsData)
            ? (paymentsData as PaymentRecord[])
            : []
        );

        setExpenses(
          Array.isArray(expensesData)
            ? (expensesData as ExpenseRecord[])
            : []
        );

        setInvoices(
          Array.isArray(invoicesData)
            ? (invoicesData as InvoiceRecord[])
            : []
        );

        setQuotes(
          Array.isArray(
            quotesResult.data
          )
            ? (quotesResult.data as QuoteRecord[])
            : []
        );

        setCustomers(
          Array.isArray(
            customersResult.data
          )
            ? (customersResult.data as CustomerRecord[])
            : []
        );

        /*
         * Só mostramos erro geral quando as quatro tabelas
         * financeiras principais falham simultaneamente.
         */

        const financialErrors =
          [
            salesError,
            paymentsError,
            expensesError,
            invoicesError,
          ].filter(Boolean);

        if (
          financialErrors.length === 4
        ) {
          setErrorMessage(
            'Não foi possível carregar os dados financeiros deste workspace.'
          );
        }
      } catch (error) {
        console.error(
          '[ReportsPage] Erro inesperado:',
          error
        );

        if (!mounted) {
          return;
        }

        setErrorMessage(
          'Ocorreu um erro ao carregar os relatórios.'
        );

        setSales([]);
        setPayments([]);
        setExpenses([]);
        setInvoices([]);
        setQuotes([]);
        setCustomers([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [workspace?.id]);

  /*
   * ============================================================
   * FECHAR MENU DE EXPORTAÇÃO
   * ============================================================
   */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent
    ) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
    };
  }, []);

  /*
   * ============================================================
   * PERÍODO
   * ============================================================
   */

  const periodStart =
    useMemo(() => {
      const now = new Date();

      if (timeframe === 'all') {
        return null;
      }

      if (timeframe === 'year') {
        return new Date(
          now.getFullYear(),
          0,
          1,
          0,
          0,
          0,
          0
        );
      }

      if (
        timeframe === 'quarter'
      ) {
        const month =
          Math.floor(
            now.getMonth() / 3
          ) * 3;

        return new Date(
          now.getFullYear(),
          month,
          1,
          0,
          0,
          0,
          0
        );
      }

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
    }, [timeframe]);

  const periodLabel =
    useMemo(() => {
      switch (timeframe) {
        case 'month':
          return 'Este mês';

        case 'quarter':
          return 'Este trimestre';

        case 'year':
          return 'Este ano';

        default:
          return 'Histórico completo';
      }
    }, [timeframe]);

  const isDateInPeriod = (
    date: Date | null
  ) => {
    if (timeframe === 'all') {
      return true;
    }

    if (!date || !periodStart) {
      return false;
    }

    const now = new Date();

    return (
      date >= periodStart &&
      date <= now
    );
  };

  /*
   * ============================================================
   * DADOS FILTRADOS
   * ============================================================
   */

  const filteredSales =
    useMemo(() => {
      return sales.filter(
        (sale) =>
          isDateInPeriod(
            getFlexibleDate(
              sale.sale_date
            )
          )
      );
    }, [
      sales,
      timeframe,
      periodStart,
    ]);

  const filteredPayments =
    useMemo(() => {
      return payments.filter(
        (payment) =>
          isDateInPeriod(
            getFlexibleDate(
              payment.payment_date
            )
          )
      );
    }, [
      payments,
      timeframe,
      periodStart,
    ]);

  const filteredExpenses =
    useMemo(() => {
      return expenses.filter(
        (expense) =>
          isDateInPeriod(
            getFlexibleDate(
              expense.expense_date
            )
          )
      );
    }, [
      expenses,
      timeframe,
      periodStart,
    ]);

  const filteredInvoices =
    useMemo(() => {
      return invoices.filter(
        (invoice) =>
          isDateInPeriod(
            getFlexibleDate(
              invoice.issue_date
            )
          )
      );
    }, [
      invoices,
      timeframe,
      periodStart,
    ]);

  const filteredQuotes =
    useMemo(() => {
      return quotes.filter(
        (quote) =>
          isDateInPeriod(
            getQuoteDate(quote)
          )
      );
    }, [
      quotes,
      timeframe,
      periodStart,
    ]);

  /*
   * ============================================================
   * VENDAS CONFIRMADAS
   * ============================================================
   */

  const confirmedSales =
    useMemo(() => {
      return filteredSales.filter(
        (sale) =>
          sale.status ===
          'confirmed'
      );
    }, [filteredSales]);

  /*
   * ============================================================
   * RECEITA
   *
   * Receita operacional:
   * vendas confirmadas.
   * ============================================================
   */

  const totalIncome =
    useMemo(() => {
      return confirmedSales.reduce(
        (sum, sale) =>
          sum +
          getNumber(sale.total),
        0
      );
    }, [confirmedSales]);

  /*
   * ============================================================
   * PAGAMENTOS RECEBIDOS
   * ============================================================
   */

  const paidPayments =
    useMemo(() => {
      return filteredPayments.filter(
        (payment) =>
          payment.status === 'paid'
      );
    }, [filteredPayments]);

  const totalPayments =
    useMemo(() => {
      return paidPayments.reduce(
        (sum, payment) =>
          sum +
          getNumber(payment.amount),
        0
      );
    }, [paidPayments]);

  /*
   * ============================================================
   * DESPESAS
   * ============================================================
   */

  const paidExpenses =
    useMemo(() => {
      return filteredExpenses.filter(
        (expense) =>
          expense.status === 'paid'
      );
    }, [filteredExpenses]);

  const totalExpenses =
    useMemo(() => {
      return paidExpenses.reduce(
        (sum, expense) =>
          sum +
          getNumber(expense.amount),
        0
      );
    }, [paidExpenses]);

  /*
   * ============================================================
   * LUCRO
   * ============================================================
   */

  const netProfit =
    totalIncome -
    totalExpenses;

  const profitMargin =
    totalIncome > 0
      ? Math.round(
          (netProfit /
            totalIncome) *
            100
        )
      : 0;

  /*
   * ============================================================
   * ORÇAMENTOS
   * ============================================================
   */

  const acceptedQuotes =
    useMemo(() => {
      return filteredQuotes.filter(
        (quote) =>
          quote.status ===
          'accepted'
      );
    }, [filteredQuotes]);

  const conversionRate =
    filteredQuotes.length > 0
      ? Math.round(
          (acceptedQuotes.length /
            filteredQuotes.length) *
            100
        )
      : 0;

  const totalQuotesValue =
    useMemo(() => {
      return filteredQuotes.reduce(
        (sum, quote) =>
          sum +
          getNumber(quote.total),
        0
      );
    }, [filteredQuotes]);

  const acceptedQuotesValue =
    useMemo(() => {
      return acceptedQuotes.reduce(
        (sum, quote) =>
          sum +
          getNumber(quote.total),
        0
      );
    }, [acceptedQuotes]);

  /*
   * ============================================================
   * FATURAS
   * ============================================================
   */

  const invoiceSummary =
    useMemo<InvoiceSummary>(() => {
      const result: InvoiceSummary = {
        total: filteredInvoices.length,
        paid: 0,
        pending: 0,
        overdue: 0,
        totalValue: 0,
        paidValue: 0,
        pendingValue: 0,
      };

      filteredInvoices.forEach(
        (invoice) => {
          const total =
            getNumber(
              invoice.total
            );

          const paid =
            getNumber(
              invoice.amount_paid
            );

          result.totalValue +=
            total;

          result.paidValue +=
            paid;

          result.pendingValue +=
            Math.max(
              total - paid,
              0
            );

          if (
            invoice.status ===
            'paid'
          ) {
            result.paid += 1;
          } else if (
            invoice.status ===
            'overdue'
          ) {
            result.overdue += 1;
          } else if (
            invoice.status ===
              'issued' ||
            invoice.status ===
              'partial'
          ) {
            result.pending += 1;
          }
        }
      );

      return result;
    }, [filteredInvoices]);

  /*
   * ============================================================
   * DESPESAS POR CATEGORIA
   * ============================================================
   */

  const expensesByCategory =
    useMemo<
      ExpenseCategory[]
    >(() => {
      const map: Record<
        string,
        number
      > = {};

      paidExpenses.forEach(
        (expense) => {
          const category =
            expense.category?.trim() ||
            'Outros';

          map[category] =
            (map[category] || 0) +
            getNumber(
              expense.amount
            );
        }
      );

      return Object.entries(map)
        .map(
          ([
            category,
            amount,
          ]) => ({
            category,
            amount,
            percentage:
              totalExpenses > 0
                ? Math.round(
                    (amount /
                      totalExpenses) *
                      100
                  )
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.amount -
            a.amount
        );
    }, [
      paidExpenses,
      totalExpenses,
    ]);

  /*
   * ============================================================
   * EVOLUÇÃO SEMESTRAL
   *
   * Receita = vendas confirmadas
   * Pagamentos = pagamentos pagos
   * Despesas = despesas pagas
   * ============================================================
   */

  const monthlyData =
    useMemo<MonthlyData[]>(() => {
      const now = new Date();

      const result: MonthlyData[] =
        [];

      for (
        let i = 5;
        i >= 0;
        i--
      ) {
        const date =
          new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
          );

        const monthIndex =
          date.getMonth();

        const year =
          date.getFullYear();

        const income =
          confirmedSales
            .filter((sale) => {
              const saleDate =
                getFlexibleDate(
                  sale.sale_date
                );

              return (
                saleDate !== null &&
                saleDate.getMonth() ===
                  monthIndex &&
                saleDate.getFullYear() ===
                  year
              );
            })
            .reduce(
              (sum, sale) =>
                sum +
                getNumber(
                  sale.total
                ),
              0
            );

        const paymentsValue =
          paidPayments
            .filter(
              (payment) => {
                const paymentDate =
                  getFlexibleDate(
                    payment.payment_date
                  );

                return (
                  paymentDate !==
                    null &&
                  paymentDate.getMonth() ===
                    monthIndex &&
                  paymentDate.getFullYear() ===
                    year
                );
              }
            )
            .reduce(
              (
                sum,
                payment
              ) =>
                sum +
                getNumber(
                  payment.amount
                ),
              0
            );

        const expense =
          paidExpenses
            .filter(
              (expenseItem) => {
                const expenseDate =
                  getFlexibleDate(
                    expenseItem.expense_date
                  );

                return (
                  expenseDate !==
                    null &&
                  expenseDate.getMonth() ===
                    monthIndex &&
                  expenseDate.getFullYear() ===
                    year
                );
              }
            )
            .reduce(
              (
                sum,
                expenseItem
              ) =>
                sum +
                getNumber(
                  expenseItem.amount
                ),
              0
            );

        result.push({
          month:
            MONTHS[
              monthIndex
            ],
          year,
          income,
          payments:
            paymentsValue,
          expense,
        });
      }

      return result;
    }, [
      confirmedSales,
      paidPayments,
      paidExpenses,
    ]);

  const maxMonthValue =
    useMemo(() => {
      return Math.max(
        ...monthlyData.map(
          (item) =>
            Math.max(
              item.income,
              item.expense,
              item.payments
            )
        ),
        100
      );
    }, [monthlyData]);

  /*
   * ============================================================
   * PRINCIPAIS CLIENTES
   * ============================================================
   */

  const topCustomers =
    useMemo<
      TopCustomer[]
    >(() => {
      const map: Record<
        string,
        TopCustomer
      > = {};

      confirmedSales.forEach(
        (sale) => {
          const customerId =
            sale.customer_id ||
            'general';

          const customer =
            customers.find(
              (item) =>
                item.id ===
                sale.customer_id
            );

          const name =
            customer
              ? getCustomerName(
                  customer
                )
              : 'Cliente Geral';

          if (!map[customerId]) {
            map[customerId] = {
              id: customerId,
              name,
              count: 0,
              total: 0,
            };
          }

          map[customerId].count +=
            1;

          map[customerId].total +=
            getNumber(
              sale.total
            );
        }
      );

      return Object.values(map)
        .sort(
          (a, b) =>
            b.total -
            a.total
        )
        .slice(0, 5);
    }, [
      confirmedSales,
      customers,
    ]);

  /*
   * ============================================================
   * EXPORTAÇÃO CSV
   * ============================================================
   */

  const handleExportReportCSV =
    () => {
      const lines: string[] =
        [];

      lines.push(
        'Relatório de Performance Stalmind'
      );

      lines.push(
        `Período,${csvEscape(
          periodLabel
        )}`
      );

      lines.push(
        `Data de geração,${csvEscape(
          formatDate(new Date())
        )}`
      );

      lines.push('');

      lines.push(
        'Resumo Financeiro'
      );

      lines.push(
        'Indicador,Valor'
      );

      lines.push(
        `Receita Total,${csvEscape(
          totalIncome
        )}`
      );

      lines.push(
        `Pagamentos Recebidos,${csvEscape(
          totalPayments
        )}`
      );

      lines.push(
        `Despesas Totais,${csvEscape(
          totalExpenses
        )}`
      );

      lines.push(
        `Lucro Líquido,${csvEscape(
          netProfit
        )}`
      );

      lines.push(
        `Margem de Lucro,${csvEscape(
          `${profitMargin}%`
        )}`
      );

      lines.push(
        `Clientes,${csvEscape(
          customers.length
        )}`
      );

      lines.push(
        `Vendas Confirmadas,${csvEscape(
          confirmedSales.length
        )}`
      );

      lines.push(
        `Orçamentos Emitidos,${csvEscape(
          filteredQuotes.length
        )}`
      );

      lines.push(
        `Orçamentos Aceites,${csvEscape(
          acceptedQuotes.length
        )}`
      );

      lines.push(
        `Taxa de Conversão,${csvEscape(
          `${conversionRate}%`
        )}`
      );

      lines.push(
        `Faturas,${csvEscape(
          invoiceSummary.total
        )}`
      );

      lines.push(
        `Faturas Pagas,${csvEscape(
          invoiceSummary.paid
        )}`
      );

      lines.push(
        `Faturas Pendentes,${csvEscape(
          invoiceSummary.pending
        )}`
      );

      lines.push(
        `Faturas Vencidas,${csvEscape(
          invoiceSummary.overdue
        )}`
      );

      lines.push('');

      lines.push(
        'Despesas por Categoria'
      );

      lines.push(
        'Categoria,Valor,Percentual'
      );

      expensesByCategory.forEach(
        (item) => {
          lines.push(
            [
              csvEscape(
                item.category
              ),
              csvEscape(
                item.amount
              ),
              csvEscape(
                `${item.percentage}%`
              ),
            ].join(',')
          );
        }
      );

      lines.push('');

      lines.push(
        'Principais Clientes'
      );

      lines.push(
        'Cliente,Transações,Total'
      );

      topCustomers.forEach(
        (customer) => {
          lines.push(
            [
              csvEscape(
                customer.name
              ),
              csvEscape(
                customer.count
              ),
              csvEscape(
                customer.total
              ),
            ].join(',')
          );
        }
      );

      lines.push('');

      lines.push(
        'Evolução Financeira'
      );

      lines.push(
        'Mês,Ano,Receitas,Pagamentos,Despesas,Resultado'
      );

      monthlyData.forEach(
        (month) => {
          lines.push(
            [
              csvEscape(
                month.month
              ),
              csvEscape(
                month.year
              ),
              csvEscape(
                month.income
              ),
              csvEscape(
                month.payments
              ),
              csvEscape(
                month.expense
              ),
              csvEscape(
                month.income -
                  month.expense
              ),
            ].join(',')
          );
        }
      );

      const csv =
        '\uFEFF' +
        lines.join('\n');

      const blob =
        new Blob([csv], {
          type: 'text/csv;charset=utf-8;',
        });

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          'a'
        );

      link.href = url;

      link.download =
        `relatorio_stalmind_${new Date()
          .toISOString()
          .split('T')[0]}.csv`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      setExportMenuOpen(false);
    };

  /*
   * ============================================================
   * EXPORTAÇÃO PDF
   * ============================================================
   */

  const handleExportReportPDF =
    () => {
      try {
        const doc =
          new jsPDF({
            orientation:
              'portrait',
            unit: 'mm',
            format: 'a4',
          });

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        const margin = 14;

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(20);

        doc.text(
          'Stalmind',
          margin,
          18
        );

        doc.setFontSize(12);

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.text(
          'Relatório de Performance',
          margin,
          25
        );

        doc.setFontSize(9);

        doc.setTextColor(
          100,
          116,
          139
        );

        doc.text(
          `Período: ${periodLabel}`,
          margin,
          32
        );

        doc.text(
          `Gerado em: ${formatDate(
            new Date()
          )}`,
          pageWidth -
            margin -
            45,
          32
        );

        doc.setTextColor(
          15,
          23,
          42
        );

        autoTable(doc, {
          startY: 40,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              'Indicador',
              'Valor',
            ],
          ],
          body: [
            [
              'Receita Total',
              formatAmount(
                totalIncome,
                currencySymbol
              ),
            ],
            [
              'Pagamentos Recebidos',
              formatAmount(
                totalPayments,
                currencySymbol
              ),
            ],
            [
              'Despesas Totais',
              formatAmount(
                totalExpenses,
                currencySymbol
              ),
            ],
            [
              'Lucro Líquido',
              formatAmount(
                netProfit,
                currencySymbol
              ),
            ],
            [
              'Margem de Lucro',
              `${profitMargin}%`,
            ],
            [
              'Clientes',
              String(
                customers.length
              ),
            ],
            [
              'Vendas Confirmadas',
              String(
                confirmedSales.length
              ),
            ],
            [
              'Taxa de Conversão',
              `${conversionRate}%`,
            ],
          ],
          theme: 'grid',
          headStyles: {
            fillColor: [
              79,
              70,
              229,
            ],
            textColor: 255,
            fontStyle:
              'bold',
          },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
        });

        let currentY =
          (
            doc as any
          ).lastAutoTable.finalY +
          10;

        if (
          currentY >
          pageHeight - 55
        ) {
          doc.addPage();

          currentY = 20;
        }

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(12);

        doc.text(
          'Evolução Financeira',
          margin,
          currentY
        );

        autoTable(doc, {
          startY:
            currentY + 4,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              'Mês',
              'Ano',
              'Receitas',
              'Pagamentos',
              'Despesas',
              'Resultado',
            ],
          ],
          body:
            monthlyData.map(
              (item) => [
                item.month,
                String(
                  item.year
                ),
                formatAmount(
                  item.income,
                  currencySymbol
                ),
                formatAmount(
                  item.payments,
                  currencySymbol
                ),
                formatAmount(
                  item.expense,
                  currencySymbol
                ),
                formatAmount(
                  item.income -
                    item.expense,
                  currencySymbol
                ),
              ]
            ),
          theme: 'striped',
          headStyles: {
            fillColor: [
              15,
              23,
              42,
            ],
            textColor: 255,
            fontStyle:
              'bold',
          },
          styles: {
            fontSize: 7,
            cellPadding: 2.5,
          },
        });

        currentY =
          (
            doc as any
          ).lastAutoTable.finalY +
          10;

        if (
          currentY >
          pageHeight - 55
        ) {
          doc.addPage();

          currentY = 20;
        }

        doc.setFontSize(12);

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.text(
          'Despesas por Categoria',
          margin,
          currentY
        );

        autoTable(doc, {
          startY:
            currentY + 4,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              'Categoria',
              'Valor',
              'Percentual',
            ],
          ],
          body:
            expensesByCategory.length >
            0
              ? expensesByCategory.map(
                  (item) => [
                    item.category,
                    formatAmount(
                      item.amount,
                      currencySymbol
                    ),
                    `${item.percentage}%`,
                  ]
                )
              : [
                  [
                    'Nenhuma despesa registrada',
                    '-',
                    '-',
                  ],
                ],
          theme: 'striped',
          headStyles: {
            fillColor: [
              225,
              29,
              72,
            ],
            textColor: 255,
            fontStyle:
              'bold',
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
        });

        currentY =
          (
            doc as any
          ).lastAutoTable.finalY +
          10;

        if (
          currentY >
          pageHeight - 55
        ) {
          doc.addPage();

          currentY = 20;
        }

        doc.setFontSize(12);

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.text(
          'Principais Clientes',
          margin,
          currentY
        );

        autoTable(doc, {
          startY:
            currentY + 4,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              '#',
              'Cliente',
              'Transações',
              'Faturamento',
            ],
          ],
          body:
            topCustomers.length >
            0
              ? topCustomers.map(
                  (
                    customer,
                    index
                  ) => [
                    String(
                      index + 1
                    ),
                    customer.name,
                    String(
                      customer.count
                    ),
                    formatAmount(
                      customer.total,
                      currencySymbol
                    ),
                  ]
                )
              : [
                  [
                    '-',
                    'Nenhum cliente com faturamento registrado',
                    '-',
                    '-',
                  ],
                ],
          theme: 'striped',
          headStyles: {
            fillColor: [
              245,
              158,
              11,
            ],
            textColor: 255,
            fontStyle:
              'bold',
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
        });

        currentY =
          (
            doc as any
          ).lastAutoTable.finalY +
          10;

        if (
          currentY >
          pageHeight - 60
        ) {
          doc.addPage();

          currentY = 20;
        }

        doc.setFontSize(12);

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.text(
          'Funil Comercial',
          margin,
          currentY
        );

        autoTable(doc, {
          startY:
            currentY + 4,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              'Indicador',
              'Quantidade',
              'Valor',
            ],
          ],
          body: [
            [
              'Orçamentos Emitidos',
              String(
                filteredQuotes.length
              ),
              formatAmount(
                totalQuotesValue,
                currencySymbol
              ),
            ],
            [
              'Orçamentos Aceites',
              String(
                acceptedQuotes.length
              ),
              formatAmount(
                acceptedQuotesValue,
                currencySymbol
              ),
            ],
            [
              'Taxa de Conversão',
              `${conversionRate}%`,
              '-',
            ],
            [
              'Faturas Emitidas',
              String(
                invoiceSummary.total
              ),
              formatAmount(
                invoiceSummary.totalValue,
                currencySymbol
              ),
            ],
            [
              'Faturas Pagas',
              String(
                invoiceSummary.paid
              ),
              formatAmount(
                invoiceSummary.paidValue,
                currencySymbol
              ),
            ],
          ],
          theme: 'grid',
          headStyles: {
            fillColor: [
              79,
              70,
              229,
            ],
            textColor: 255,
            fontStyle:
              'bold',
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
        });

        const totalPages =
          (
            doc as any
          ).internal.getNumberOfPages();

        for (
          let page = 1;
          page <= totalPages;
          page++
        ) {
          doc.setPage(page);

          doc.setFontSize(8);

          doc.setFont(
            'helvetica',
            'normal'
          );

          doc.setTextColor(
            100,
            116,
            139
          );

          doc.text(
            'Stalmind Business ERP AI',
            margin,
            pageHeight - 8
          );

          doc.text(
            `Página ${page} de ${totalPages}`,
            pageWidth -
              margin -
              30,
            pageHeight - 8
          );
        }

        doc.save(
          `relatorio_stalmind_${new Date()
            .toISOString()
            .split('T')[0]}.pdf`
        );

        setExportMenuOpen(false);
      } catch (error) {
        console.error(
          '[ReportsPage] Erro ao gerar PDF:',
          error
        );

        window.alert(
          'Não foi possível gerar o PDF. Verifique se jspdf e jspdf-autotable estão instalados.'
        );
      }
    };

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            A carregar relatórios...
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />

            Relatórios & Análise
          </h1>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visão aprofundada sobre a saúde financeira,
            conversão comercial e rentabilidade do negócio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* FILTRO */}

          <select
            value={timeframe}
            onChange={(event) =>
              setTimeframe(
                event.target
                  .value as Timeframe
              )
            }
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="year">
              Este Ano
            </option>

            <option value="quarter">
              Este Trimestre
            </option>

            <option value="month">
              Este Mês
            </option>

            <option value="all">
              Histórico Completo
            </option>
          </select>

          {/* EXPORTAÇÃO */}

          <div
            className="relative"
            ref={exportMenuRef}
          >
            <button
              type="button"
              onClick={() =>
                setExportMenuOpen(
                  (current) =>
                    !current
                )
              }
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              aria-haspopup="menu"
              aria-expanded={
                exportMenuOpen
              }
            >
              <Download className="w-3.5 h-3.5" />

              <span>
                Exportar Relatório
              </span>

              {exportMenuOpen ? (
                <X className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 ml-1 rotate-90" />
              )}
            </button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden"
                role="menu"
              >
                <button
                  type="button"
                  onClick={
                    handleExportReportPDF
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  role="menuitem"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Exportar PDF
                    </p>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Relatório profissional
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={
                    handleExportReportCSV
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
                  role="menuitem"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Exportar CSV
                    </p>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Dados para Excel
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ERRO */}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <X className="w-4 h-4" />
            </div>

            <div>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                Não foi possível carregar todos os dados
              </p>

              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                {errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* INDICADOR DO PERÍODO */}

      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />

        Dados apresentados para:

        <strong className="text-slate-700 dark:text-slate-200">
          {periodLabel}
        </strong>
      </div>

      {/* KPI */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RECEITA */}

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Receita Total
            </span>

            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatAmount(
                totalIncome,
                currencySymbol
              )}
            </h3>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Vendas confirmadas no período
            </p>
          </div>
        </div>

        {/* DESPESAS */}

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Despesas Totais
            </span>

            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatAmount(
                totalExpenses,
                currencySymbol
              )}
            </h3>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Despesas liquidadas
            </p>
          </div>
        </div>

        {/* LUCRO */}

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lucro Líquido
            </span>

            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                netProfit >= 0
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400'
                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
              }`}
            >
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <h3
              className={`text-2xl font-bold ${
                netProfit >= 0
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatAmount(
                netProfit,
                currencySymbol
              )}
            </h3>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Margem operacional de{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {profitMargin}%
              </span>
            </p>
          </div>
        </div>

        {/* CONVERSÃO */}

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Eficácia Comercial
            </span>

            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {conversionRate}%
            </h3>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {acceptedQuotes.length} de{' '}
              {filteredQuotes.length}{' '}
              orçamentos aceites
            </p>
          </div>
        </div>
      </div>

      {/* PAGAMENTOS + FATURAS */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Pagamentos Recebidos
              </p>

              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {formatAmount(
                  totalPayments,
                  currencySymbol
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Faturas Emitidas
              </p>

              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {invoiceSummary.total}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Faturas Pendentes
              </p>

              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {formatAmount(
                  invoiceSummary.pendingValue,
                  currencySymbol
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* GRÁFICO + CATEGORIAS */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO */}

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Evolução Financeira Semestral
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comparativo mensal entre Receitas e Despesas
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />

                <span className="text-slate-600 dark:text-slate-400">
                  Receitas
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-rose-400" />

                <span className="text-slate-600 dark:text-slate-400">
                  Despesas
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 sm:gap-6 h-48 items-end border-b border-slate-200 dark:border-slate-800 pb-2">
            {monthlyData.map(
              (
                item,
                index
              ) => {
                const incomeHeight =
                  maxMonthValue >
                  0
                    ? (item.income /
                        maxMonthValue) *
                      100
                    : 0;

                const expenseHeight =
                  maxMonthValue >
                  0
                    ? (item.expense /
                        maxMonthValue) *
                      100
                    : 0;

                return (
                  <div
                    key={`${item.year}-${item.month}-${index}`}
                    className="flex flex-col items-center h-full justify-end group"
                  >
                    <div className="w-full flex items-end justify-center gap-1.5 h-full max-h-36">
                      <div
                        style={{
                          height: `${Math.max(
                            incomeHeight,
                            item.income >
                              0
                              ? 4
                              : 0
                          )}%`,
                        }}
                        className="w-full max-w-[18px] bg-emerald-500 dark:bg-emerald-400 rounded-t-md transition-all"
                        title={`Receitas: ${formatAmount(
                          item.income,
                          currencySymbol
                        )}`}
                      />

                      <div
                        style={{
                          height: `${Math.max(
                            expenseHeight,
                            item.expense >
                              0
                              ? 4
                              : 0
                          )}%`,
                        }}
                        className="w-full max-w-[18px] bg-rose-400 dark:bg-rose-500 rounded-t-md transition-all"
                        title={`Despesas: ${formatAmount(
                          item.expense,
                          currencySymbol
                        )}`}
                      />
                    </div>

                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2">
                      {item.month}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* CATEGORIAS */}

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />

              Despesas por Categoria
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Onde o seu dinheiro está a ser investido
            </p>

            <div className="mt-5 space-y-3.5">
              {expensesByCategory.length ===
              0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhuma despesa registada para categorização.
                </div>
              ) : (
                expensesByCategory
                  .slice(0, 5)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${item.category}-${index}`}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-medium gap-2">
                          <span className="text-slate-700 dark:text-slate-300 truncate">
                            {item.category}
                          </span>

                          <span className="text-slate-900 dark:text-white font-mono font-bold whitespace-nowrap">
                            {formatAmount(
                              item.amount,
                              currencySymbol
                            )}

                            <span className="text-slate-400 ml-1 font-normal text-[10px]">
                              ({item.percentage}%)
                            </span>
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                item.percentage,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>
              Total Alocado:
            </span>

            <span className="font-bold text-slate-700 dark:text-slate-300">
              {formatAmount(
                totalExpenses,
                currencySymbol
              )}
            </span>
          </div>
        </div>
      </div>

      {/* CLIENTES + FUNIL */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CLIENTES */}

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />

              Principais Clientes por Faturamento
            </h2>

            <button
              type="button"
              onClick={() =>
                onNavigate?.(
                  '/customers'
                )
              }
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              Ver todos

              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {topCustomers.length ===
            0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Ainda não existem dados suficientes de clientes com faturamento.
              </p>
            ) : (
              topCustomers.map(
                (
                  customer,
                  index
                ) => (
                  <div
                    key={customer.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        #
                        {index + 1}
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {
                            customer.name
                          }
                        </p>

                        <span className="text-[10px] text-slate-400">
                          {
                            customer.count
                          }{' '}
                          {customer.count ===
                          1
                            ? 'transação'
                            : 'transações'}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatAmount(
                        customer.total,
                        currencySymbol
                      )}
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </div>

        {/* FUNIL */}

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />

            Funil de Propostas & Orçamentos
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>
                  Orçamentos Emitidos
                </span>

                <span className="font-mono">
                  {
                    filteredQuotes.length
                  }{' '}
                  (
                  {formatAmount(
                    totalQuotesValue,
                    currencySymbol
                  )}
                  )
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full w-full" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>
                  Propostas Aceites & Adjudicadas
                </span>

                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {
                    acceptedQuotes.length
                  }{' '}
                  (
                  {formatAmount(
                    acceptedQuotesValue,
                    currencySymbol
                  )}
                  )
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${conversionRate}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">
                  Dica do Assistente:
                </span>{' '}
                Com uma taxa de conversão de{' '}
                <span className="font-bold">
                  {conversionRate}%
                </span>
                , o acompanhamento dos orçamentos pode ajudar a aumentar o fecho de negócios.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RESUMO DE FATURAS */}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />

              Resumo de Faturas
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Situação das faturas no período selecionado
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              Total
            </p>

            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {
                invoiceSummary.total
              }
            </p>

            <p className="text-[10px] text-slate-400 mt-1">
              {formatAmount(
                invoiceSummary.totalValue,
                currencySymbol
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
              Pagas
            </p>

            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              {
                invoiceSummary.paid
              }
            </p>

            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              {formatAmount(
                invoiceSummary.paidValue,
                currencySymbol
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
              Pendentes
            </p>

            <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
              {
                invoiceSummary.pending
              }
            </p>

            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1">
              {formatAmount(
                invoiceSummary.pendingValue,
                currencySymbol
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400">
              Vencidas
            </p>

            <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
              {
                invoiceSummary.overdue
              }
            </p>

            <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-1">
              Requerem atenção
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
