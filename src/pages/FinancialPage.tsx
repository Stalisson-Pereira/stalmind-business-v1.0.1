import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { financialService } from '../services/financialService';
import { customerService } from '../services/customerService';
import {
  FinancialTransaction,
  TransactionType,
  TransactionStatus,
  TransactionCategory,
  Customer,
} from '../types';
import { Modal } from '../components/common/Modal';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  DollarSign,
  TrendingUp,
  PieChart,
  Calendar,
  Building2,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const FinancialPage: React.FC = () => {
  const { workspace } = useAuth();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType | 'pending' | 'overdue'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('income');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCategory, setFormCategory] = useState<TransactionCategory>('Vendas & Serviços');
  const [formStatus, setFormStatus] = useState<TransactionStatus>('paid');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formCustomerOrSupplier, setFormCustomerOrSupplier] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Transferência Bancária');
  const [formNotes, setFormNotes] = useState('');

  const currencySymbol = workspace?.currency === 'BRL' ? 'R$' : workspace?.currency === 'USD' ? '$' : '€';

  useEffect(() => {
    loadData();
  }, [workspace]);

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const txs = await financialService.getTransactions(workspace.id);
      const custs = await customerService.getCustomers(workspace.id);
      setTransactions(txs);
      setCustomers(custs);
    } catch (e) {
      console.error('Error loading financial data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !formTitle || !formAmount) return;

    const numericAmount = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    try {
      await financialService.addTransaction({
        workspaceId: workspace.id,
        type: formType,
        title: formTitle,
        amount: numericAmount,
        category: formCategory,
        status: formStatus,
        date: formDate,
        dueDate: formDueDate || undefined,
        customerOrSupplier: formCustomerOrSupplier || undefined,
        paymentMethod: formPaymentMethod,
        notes: formNotes || undefined,
      });

      // Reset Form & Close
      setIsModalOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormType('income');
    setFormTitle('');
    setFormAmount('');
    setFormCategory('Vendas & Serviços');
    setFormStatus('paid');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDueDate('');
    setFormCustomerOrSupplier('');
    setFormPaymentMethod('Transferência Bancária');
    setFormNotes('');
  };

  const handleMarkAsPaid = async (id: string) => {
    await financialService.updateTransactionStatus(id, 'paid');
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja eliminar esta transação?')) {
      await financialService.deleteTransaction(id);
      await loadData();
    }
  };

  // Calculations
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense' && t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const pendingIncome = transactions
    .filter((t) => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingExpense = transactions
    .filter((t) => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue'))
    .reduce((acc, t) => acc + t.amount, 0);

  // Filtered list
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.customerOrSupplier && t.customerOrSupplier.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      typeFilter === 'all'
        ? true
        : typeFilter === 'pending'
        ? t.status === 'pending'
        : typeFilter === 'overdue'
        ? t.status === 'overdue'
        : t.type === typeFilter;

    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const categoriesList: TransactionCategory[] = [
    'Vendas & Serviços',
    'Consultoria',
    'Marketing & Anúncios',
    'Software & Ferramentas',
    'Instalações & Aluguer',
    'Salários & Equipa',
    'Impostos & Taxas',
    'Outros',
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <span>Gestão Financeira</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Acompanhe fluxo de caixa, receitas, despesas e pagamentos pendentes do seu negócio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar Extrato</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Transação</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas Totais */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Receitas Realizadas
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {currencySymbol} {totalIncome.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-amber-500 font-medium">+{currencySymbol} {pendingIncome.toLocaleString('pt-PT')}</span> pendentes
          </p>
        </div>

        {/* Despesas Totais */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Despesas Realizadas
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {currencySymbol} {totalExpense.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-rose-400 font-medium">{currencySymbol} {pendingExpense.toLocaleString('pt-PT')}</span> a pagar
          </p>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Saldo Líquido
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className={`text-2xl font-bold ${netBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
            {currencySymbol} {netBalance.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Fluxo de caixa positivo
          </p>
        </div>

        {/* Status de Faturas / Pendências */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cobranças & Pendências
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {transactions.filter((t) => t.status === 'pending' || t.status === 'overdue').length}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Transações aguardando liquidação
          </p>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter Buttons */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500'
              }`}
            >
              Receitas
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-500'
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setTypeFilter('pending')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                typeFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-500'
              }`}
            >
              Pendentes
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todas as Categorias</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">A carregar registros financeiros...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma transação encontrada</p>
            <p className="text-xs text-slate-500 mt-1">Crie a sua primeira receita ou despesa para começar a gerir o financeiro.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Transação</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Descrição & Categoria</th>
                  <th className="px-5 py-3.5">Cliente / Entidade</th>
                  <th className="px-5 py-3.5">Data & Vencimento</th>
                  <th className="px-5 py-3.5">Tipo & Valor</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Title & Category */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isIncome
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{tx.title}</p>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium inline-block mt-0.5">
                              {tx.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Customer / Supplier */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-medium">
                        {tx.customerOrSupplier ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{tx.customerOrSupplier}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Date & Due Date */}
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{tx.date}</span>
                          {tx.dueDate && (
                            <span className="text-[10px] text-amber-500 font-medium">
                              Vence: {tx.dueDate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`font-bold text-sm ${
                            isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {isIncome ? '+' : '-'}{currencySymbol} {tx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {tx.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Pago
                          </span>
                        )}
                        {tx.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                        {tx.status === 'overdue' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            Atrasado
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.status !== 'paid' && (
                            <button
                              onClick={() => handleMarkAsPaid(tx.id)}
                              title="Marcar como Pago"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(tx.id)}
                            title="Eliminar"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nova Transação */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nova Transação Financeira"
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          {/* Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setFormType('income');
                setFormCategory('Vendas & Serviços');
              }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                formType === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Receita (+ Entrada)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormType('expense');
                setFormCategory('Software & Ferramentas');
              }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                formType === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Despesa (- Saída)</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição / Título da Transação *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Adjudicação de Orçamento, Licença Figma..."
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Amount & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoria
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as TransactionCategory)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer / Supplier */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cliente ou Fornecedor (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Nexus Tech, Google Ireland, etc."
              value={formCustomerOrSupplier}
              onChange={(e) => setFormCustomerOrSupplier(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data do Lançamento
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="paid">Pago / Liquidado</option>
                <option value="pending">Pendente</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Método de Pagamento
            </label>
            <select
              value={formPaymentMethod}
              onChange={(e) => setFormPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Transferência Bancária">Transferência Bancária</option>
              <option value="MB WAY">MB WAY</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Débito Direto">Débito Direto</option>
              <option value="Numerário / Dinheiro">Numerário / Dinheiro</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas Adicionais
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Referente à fatura FT 2026/04..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
            >
              Salvar Transação
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
