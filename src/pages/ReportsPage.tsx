import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  BarChart2,
  DollarSign,
  Download,
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
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useAuth } from '../contexts/AuthContext';
import { quoteService } from '../services/quoteService';
import { financialService } from '../services/financialService';
import { customerService } from '../services/customerService';
import { saleService, Sale } from '../services/saleService';

import {
  Quote,
  FinancialTransaction,
  Customer,
} from '../types';

interface ReportsPageProps {
  onNavigate?: (path: string) => void;
}

type Timeframe = 'all' | 'year' | 'quarter' | 'month';

interface MonthlyData {
  month: string;
  year: number;
  income: number;
  expense: number;
}

interface TopCustomer {
  name: string;
  count: number;
  total: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

const getFlexibleDate = (
  value: unknown
): Date | null => {
  if (!value) return null;

  const date =
    value instanceof Date
      ? value
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getQuoteDate = (
  quote: Quote
): Date | null => {
  const raw =
    quote as unknown as Record<
      string,
      unknown
    >;

  return getFlexibleDate(
    raw.date ??
      raw.createdAt ??
      raw.created_at ??
      raw.issueDate ??
      raw.issue_date
  );
};

const getSaleDate = (
  sale: Sale
): Date | null => {
  const raw =
    sale as unknown as Record<
      string,
      unknown
    >;

  return getFlexibleDate(
    raw.sale_date ??
      raw.saleDate ??
      raw.created_at ??
      raw.createdAt
  );
};

const getSaleCustomerId = (
  sale: Sale
): string | null => {
  const raw =
    sale as unknown as Record<
      string,
      unknown
    >;

  const value =
    raw.customer_id ??
    raw.customerId ??
    null;

  return value
    ? String(value)
    : null;
};

const getSaleTotal = (
  sale: Sale
): number => {
  const raw =
    sale as unknown as Record<
      string,
      unknown
    >;

  const value =
    raw.total ??
    0;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const formatAmount = (
  amount: number,
  currencySymbol: string
) => {
  return `${currencySymbol} ${Number(
    amount || 0
  ).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (
  date: Date
) => {
  return date.toLocaleDateString(
    'pt-PT'
  );
};

/*
 * ============================================================
 * COMPONENT
 * ============================================================
 */

export const ReportsPage: React.FC<
  ReportsPageProps
> = ({ onNavigate }) => {
  const { workspace } = useAuth();

  const [quotes, setQuotes] =
    useState<Quote[]>([]);

  const [
    transactions,
    setTransactions,
  ] = useState<
    FinancialTransaction[]
  >([]);

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false);

  const exportMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    timeframe,
    setTimeframe,
  ] = useState<Timeframe>('year');

  const currencySymbol =
    workspace?.currency === 'BRL'
      ? 'R$'
      : workspace?.currency === 'USD'
        ? '$'
        : '€';

  /*
   * ============================================================
   * CARREGAMENTO DOS DADOS
   *
   * RECEITA:
   *   -> sales
   *
   * DESPESAS:
   *   -> financial_transactions
   *
   * ORÇAMENTOS:
   *   -> quotes
   *
   * CLIENTES:
   *   -> customers
   * ============================================================
   */

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!workspace?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      /*
       * Carregamos cada fonte separadamente.
       *
       * Isso é importante porque:
       * se financial_transactions estiver
       * indisponível, as vendas continuam
       * funcionando normalmente.
       */

      let loadedQuotes: Quote[] = [];
      let loadedTransactions: FinancialTransaction[] =
        [];
      let loadedSales: Sale[] = [];
      let loadedCustomers: Customer[] = [];

      /*
       * ORÇAMENTOS
       */

      try {
        loadedQuotes =
          await quoteService.getQuotes(
            workspace.id
          );
      } catch (error) {
        console.error(
          '[ReportsPage] Erro ao carregar orçamentos:',
          error
        );
      }

      /*
       * VENDAS
       *
       * ESTA É A PRINCIPAL CORREÇÃO.
       *
       * A receita agora vem diretamente
       * da tabela sales.
       */

      try {
        loadedSales =
          await saleService.getSales(
            workspace.id
          );

        console.log(
          '[ReportsPage] Vendas carregadas:',
          loadedSales.length,
          loadedSales
        );
      } catch (error) {
        console.error(
          '[ReportsPage] Erro ao carregar vendas:',
          error
        );
      }

      /*
       * TRANSAÇÕES FINANCEIRAS
       *
       * Usadas principalmente para despesas.
       *
       * Se financial_transactions não existir,
       * o financialService fará fallback para
       * localStorage.
       */

      try {
        loadedTransactions =
          await financialService.getTransactions(
            workspace.id
          );

        console.log(
          '[ReportsPage] Transações financeiras:',
          loadedTransactions.length
        );
      } catch (error) {
        console.error(
          '[ReportsPage] Erro ao carregar transações financeiras:',
          error
        );
      }

      /*
       * CLIENTES
       */

      try {
        loadedCustomers =
          await customerService.getCustomers(
            workspace.id
          );
      } catch (error) {
        console.error(
          '[ReportsPage] Erro ao carregar clientes:',
          error
        );
      }

      if (!mounted) {
        return;
      }

      setQuotes(
        Array.isArray(loadedQuotes)
          ? loadedQuotes
          : []
      );

      setTransactions(
        Array.isArray(
          loadedTransactions
        )
          ? loadedTransactions
          : []
      );

      setSales(
        Array.isArray(loadedSales)
          ? loadedSales
          : []
      );

      setCustomers(
        Array.isArray(loadedCustomers)
          ? loadedCustomers
          : []
      );

      setLoading(false);
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

  const periodStart = useMemo(() => {
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

    if (timeframe === 'quarter') {
      const quarterStartMonth =
        Math.floor(
          now.getMonth() / 3
        ) * 3;

      return new Date(
        now.getFullYear(),
        quarterStartMonth,
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

  const periodLabel = useMemo(() => {
    switch (timeframe) {
      case 'month':
        return 'Este mês';

      case 'quarter':
        return 'Este trimestre';

      case 'year':
        return 'Este ano';

      case 'all':
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
   * VENDAS FILTRADAS
   * ============================================================
   */

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      /*
       * Apenas vendas confirmadas entram
       * no faturamento.
       *
       * cancelled e refunded não entram.
       */

      if (
        sale.status !== 'confirmed'
      ) {
        return false;
      }

      const date =
        getSaleDate(sale);

      return isDateInPeriod(date);
    });
  }, [
    sales,
    timeframe,
    periodStart,
  ]);

  /*
   * ============================================================
   * TRANSAÇÕES FILTRADAS
   * ============================================================
   */

  const filteredTransactions =
    useMemo(() => {
      return transactions.filter(
        (transaction) => {
          const date =
            getFlexibleDate(
              transaction.date
            );

          return isDateInPeriod(date);
        }
      );
    }, [
      transactions,
      timeframe,
      periodStart,
    ]);

  /*
   * ============================================================
   * ORÇAMENTOS FILTRADOS
   * ============================================================
   */

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      if (timeframe === 'all') {
        return true;
      }

      const date =
        getQuoteDate(quote);

      return isDateInPeriod(date);
    });
  }, [
    quotes,
    timeframe,
    periodStart,
  ]);

  /*
   * ============================================================
   * RECEITA
   *
   * CORREÇÃO PRINCIPAL:
   *
   * Antes:
   *   financial_transactions
   *
   * Agora:
   *   sales.total
   *
   * Exemplo:
   *
   * Venda 1 = €10
   * Venda 2 = €80
   * Venda 3 = €60
   *
   * Receita = €150
   * ============================================================
   */

  const totalIncome = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) => {
        return (
          sum +
          getSaleTotal(sale)
        );
      },
      0
    );
  }, [filteredSales]);

  /*
   * ============================================================
   * DESPESAS
   * ============================================================
   */

  const expenseTransactions =
    useMemo(() => {
      return filteredTransactions.filter(
        (transaction) =>
          transaction.type ===
          'expense'
      );
    }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return expenseTransactions
      .filter(
        (transaction) =>
          transaction.status ===
          'paid'
      )
      .reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      );
  }, [expenseTransactions]);

  /*
   * ============================================================
   * LUCRO
   * ============================================================
   */

  const netProfit =
    totalIncome - totalExpenses;

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
    useMemo(() => {
      if (
        filteredQuotes.length ===
        0
      ) {
        return 0;
      }

      return Math.round(
        (acceptedQuotes.length /
          filteredQuotes.length) *
          100
      );
    }, [
      filteredQuotes.length,
      acceptedQuotes.length,
    ]);

  const totalQuotesValue =
    useMemo(() => {
      return filteredQuotes.reduce(
        (sum, quote) =>
          sum +
          Number(
            quote.total || 0
          ),
        0
      );
    }, [filteredQuotes]);

  const acceptedQuotesValue =
    useMemo(() => {
      return acceptedQuotes.reduce(
        (sum, quote) =>
          sum +
          Number(
            quote.total || 0
          ),
        0
      );
    }, [acceptedQuotes]);

  /*
   * ============================================================
   * DESPESAS POR CATEGORIA
   * ============================================================
   */

  const expensesByCategory =
    useMemo<ExpenseCategory[]>(
      () => {
        const map: Record<
          string,
          number
        > = {};

        expenseTransactions
          .filter(
            (transaction) =>
              transaction.status ===
              'paid'
          )
          .forEach(
            (transaction) => {
              const category =
                transaction.category ||
                'Outros';

              map[category] =
                (map[category] || 0) +
                Number(
                  transaction.amount ||
                    0
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
      },
      [
        expenseTransactions,
        totalExpenses,
      ]
    );

  /*
   * ============================================================
   * EVOLUÇÃO MENSAL
   *
   * Receita = vendas confirmadas
   * Despesa = financial_transactions
   * ============================================================
   */

  const monthlyData =
    useMemo<MonthlyData[]>(() => {
      const months = [
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

      const now =
        new Date();

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
            now.getMonth() -
              i,
            1
          );

        const monthIndex =
          date.getMonth();

        const year =
          date.getFullYear();

        /*
         * RECEITAS DAS VENDAS
         */

        const income =
          filteredSales
            .filter((sale) => {
              const saleDate =
                getSaleDate(
                  sale
                );

              if (
                !saleDate
              ) {
                return false;
              }

              return (
                saleDate.getMonth() ===
                  monthIndex &&
                saleDate.getFullYear() ===
                  year
              );
            })
            .reduce(
              (
                sum,
                sale
              ) =>
                sum +
                getSaleTotal(
                  sale
                ),
              0
            );

        /*
         * DESPESAS
         */

        const expense =
          expenseTransactions
            .filter(
              (
                transaction
              ) => {
                if (
                  transaction.status !==
                  'paid'
                ) {
                  return false;
                }

                const transactionDate =
                  getFlexibleDate(
                    transaction.date
                  );

                if (
                  !transactionDate
                ) {
                  return false;
                }

                return (
                  transactionDate.getMonth() ===
                    monthIndex &&
                  transactionDate.getFullYear() ===
                    year
                );
              }
            )
            .reduce(
              (
                sum,
                transaction
              ) =>
                sum +
                Number(
                  transaction.amount ||
                    0
                ),
              0
            );

        result.push({
          month:
            months[
              monthIndex
            ],
          year,
          income,
          expense,
        });
      }

      return result;
    }, [
      filteredSales,
      expenseTransactions,
    ]);

  const maxMonthValue =
    useMemo(() => {
      return Math.max(
        ...monthlyData.map(
          (item) =>
            Math.max(
              item.income,
              item.expense
            )
        ),
        100
      );
    }, [monthlyData]);

  /*
   * ============================================================
   * PRINCIPAIS CLIENTES
   *
   * Agora calculados pelas vendas.
   * ============================================================
   */

  const topCustomers =
    useMemo<TopCustomer[]>(() => {
      const map: Record<
        string,
        TopCustomer
      > = {};

      filteredSales.forEach(
        (sale) => {
          const customerId =
            getSaleCustomerId(
              sale
            );

          let customerName =
            'Cliente Geral';

          if (
            customerId
          ) {
            const customer =
              customers.find(
                (item) => {
                  const raw =
                    item as unknown as Record<
                      string,
                      unknown
                    >;

                  return (
                    String(
                      raw.id
                    ) ===
                    customerId
                  );
                }
              );

            if (customer) {
              const raw =
                customer as unknown as Record<
                  string,
                  unknown
                >;

              customerName =
                String(
                  raw.name ??
                    raw.company ??
                    'Cliente'
                );
            }
          }

          if (
            !map[
              customerName
            ]
          ) {
            map[
              customerName
            ] = {
              name: customerName,
              count: 0,
              total: 0,
            };
          }

          map[
            customerName
          ].count += 1;

          map[
            customerName
          ].total +=
            getSaleTotal(
              sale
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
      filteredSales,
      customers,
    ]);

  /*
   * ============================================================
   * CSV
   * ============================================================
   */

  const csvEscape = (
    value: unknown
  ) => {
    const text =
      String(
        value ?? ''
      );

    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  };

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
          formatDate(
            new Date()
          )
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
        `Total de Clientes,${csvEscape(
          customers.length
        )}`
      );

      lines.push(
        `Vendas Confirmadas,${csvEscape(
          filteredSales.length
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
        'Mês,Ano,Receitas,Despesas'
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
        new Blob(
          [csv],
          {
            type: 'text/csv;charset=utf-8;',
          }
        );

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

      URL.revokeObjectURL(
        url
      );

      setExportMenuOpen(
        false
      );
    };

  /*
   * ============================================================
   * PDF
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

        /*
         * CABEÇALHO
         */

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

        /*
         * RESUMO
         */

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
                filteredSales.length
              ),
            ],
            [
              'Orçamentos Emitidos',
              String(
                filteredQuotes.length
              ),
            ],
            [
              'Orçamentos Aceites',
              String(
                acceptedQuotes.length
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

        /*
         * EVOLUÇÃO FINANCEIRA
         */

        const financialTableStart =
          (
            doc as any
          ).lastAutoTable
            .finalY + 10;

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(12);

        doc.text(
          'Evolução Financeira',
          margin,
          financialTableStart
        );

        autoTable(doc, {
          startY:
            financialTableStart +
            4,
          margin: {
            left: margin,
            right: margin,
          },
          head: [
            [
              'Mês',
              'Ano',
              'Receitas',
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
            fontSize: 8,
            cellPadding: 3,
          },
        });

        /*
         * DESPESAS POR CATEGORIA
         */

        let currentY =
          (
            doc as any
          ).lastAutoTable
            .finalY + 10;

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

        /*
         * CLIENTES
         */

        currentY =
          (
            doc as any
          ).lastAutoTable
            .finalY + 10;

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

        /*
         * FUNIL COMERCIAL
         */

        currentY =
          (
            doc as any
          ).lastAutoTable
            .finalY + 10;

        if (
          currentY >
          pageHeight - 60
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
              'Vendas Confirmadas',
              String(
                filteredSales.length
              ),
              formatAmount(
                totalIncome,
                currencySymbol
              ),
            ],
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

        /*
         * RODAPÉ
         */

        const totalPages =
          (
            doc as any
          ).internal.getNumberOfPages();

        for (
          let page = 1;
          page <=
          totalPages;
          page++
        ) {
          doc.setPage(
            page
          );

          doc.setFontSize(
            8
          );

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

        /*
         * SALVAR
         */

        doc.save(
          `relatorio_stalmind_${new Date()
            .toISOString()
            .split('T')[0]}.pdf`
        );

        setExportMenuOpen(
          false
        );
      } catch (error) {
        console.error(
          'Erro ao gerar PDF:',
          error
        );

        window.alert(
          'Não foi possível gerar o PDF. Verifique se as dependências jspdf e jspdf-autotable estão instaladas.'
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
              id="export-report-btn"
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

      {/* PERÍODO */}

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
              {filteredSales.length}{' '}
              venda
              {filteredSales.length ===
              1
                ? ''
                : 's'}{' '}
              confirmada
              {filteredSales.length ===
              1
                ? ''
                : 's'}{' '}
              no período
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
              Saídas liquidadas
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
              {acceptedQuotes.length}{' '}
              de{' '}
              {filteredQuotes.length}{' '}
              orçamentos aceites
            </p>

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

            <div className="flex items-center gap-4 text-xs">

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

          <div className="space-y-4 pt-2">

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
                          className="w-full max-w-[18px] bg-emerald-500 dark:bg-emerald-400 rounded-t-md transition-all group-hover:brightness-110"
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
                          className="w-full max-w-[18px] bg-rose-400 dark:bg-rose-500 rounded-t-md transition-all group-hover:brightness-110"
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

                        <div className="flex items-center justify-between text-xs font-medium">

                          <span className="text-slate-700 dark:text-slate-300">
                            {
                              item.category
                            }
                          </span>

                          <span className="text-slate-900 dark:text-white font-mono font-bold">

                            {formatAmount(
                              item.amount,
                              currencySymbol
                            )}

                            <span className="text-slate-400 ml-1 font-normal text-[10px]">
                              (
                              {
                                item.percentage
                              }
                              %)
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
                    key={`${customer.name}-${index}`}
                    className="py-3 flex items-center justify-between"
                  >

                    <div className="flex items-center gap-3">

                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        #
                        {index +
                          1}
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

            {/* VENDAS */}

            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">

              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">

                <span>
                  Vendas Confirmadas
                </span>

                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {
                    filteredSales.length
                  }{' '}
                  (
                  {formatAmount(
                    totalIncome,
                    currencySymbol
                  )}
                  )
                </span>

              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">

                <div className="bg-emerald-500 h-2 rounded-full w-full" />

              </div>

            </div>

            {/* ORÇAMENTOS */}

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

            {/* ACEITES */}

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

            {/* DICA */}

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

    </div>
  );
};
