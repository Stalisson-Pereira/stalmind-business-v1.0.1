import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { quoteService } from '../services/quoteService';
import { customerService } from '../services/customerService';
import { Quote, QuoteStatus, QuoteItem, Customer } from '../types';
import { Modal } from '../components/common/Modal';
import {
  FileText,
  FilePlus,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  Building2,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface QuotesPageProps {
  initialOpenModal?: boolean;
}

export const QuotesPage: React.FC<QuotesPageProps> = ({ initialOpenModal }) => {
  const { workspace } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(initialOpenModal || false);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);

  // Quote Builder State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<Omit<QuoteItem, 'id' | 'total'>[]>([
    { description: 'Desenvolvimento / Serviço Profissional', quantity: 1, unitPrice: 500 },
  ]);
  const [taxRate, setTaxRate] = useState<number>(workspace?.defaultTaxRate || 23);
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('Validade de 15 dias. Pagamento de 50% na adjudicação.');

  useEffect(() => {
    loadData();
  }, [workspace]);

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const qts = await quoteService.getQuotes(workspace.id);
      const custs = await customerService.getCustomers(workspace.id);
      setQuotes(qts);
      setCustomers(custs);
      if (custs.length > 0) setSelectedCustomerId(custs[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Omit<QuoteItem, 'id' | 'total'>, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const calculatedItems = items.map((it, idx) => ({
    id: `item_${idx}`,
    ...it,
    total: it.quantity * it.unitPrice,
  }));

  const subtotal = calculatedItems.reduce((sum, i) => sum + i.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !selectedCustomerId) return;

    const cust = customers.find((c) => c.id === selectedCustomerId);

    await quoteService.addQuote({
      workspaceId: workspace.id,
      customerId: selectedCustomerId,
      customerName: cust ? `${cust.name} (${cust.company || 'Pessoa Singular'})` : 'Cliente',
      customerEmail: cust?.email,
      customerTaxId: cust?.taxId,
      customerAddress: cust?.address,
      items: calculatedItems,
      subtotal,
      taxRate,
      taxAmount,
      total: grandTotal,
      status: 'draft',
      validUntil,
      notes,
    });

    setIsCreateOpen(false);
    loadData();
  };

  const handleStatusChange = async (id: string, newStatus: QuoteStatus) => {
    await quoteService.updateQuoteStatus(id, newStatus);
    loadData();
  };

  const currencySymbol = workspace?.currency === 'BRL' ? 'R$' : workspace?.currency === 'USD' ? '$' : '€';

  const filteredQuotes = quotes.filter(
    (q) => statusFilter === 'all' || q.status === statusFilter
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Orçamentos & Propostas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Crie, controle estados e exporte propostas comerciais para os seus clientes.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          id="create-quote-btn"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20 self-start sm:self-auto"
        >
          <FilePlus className="w-4 h-4" />
          <span>Criar Orçamento</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'draft', label: 'Rascunhos' },
          { id: 'sent', label: 'Enviados' },
          { id: 'accepted', label: 'Aceitos' },
          { id: 'declined', label: 'Recusados' },
          { id: 'expired', label: 'Expirados' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 flex justify-center text-indigo-600">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhum orçamento registado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Crie o seu primeiro orçamento profissional para apresentar valores aos seus clientes.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            Criar Orçamento Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map((q) => (
            <div
              key={q.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-indigo-500/50 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                  <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {q.quoteNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      q.status === 'accepted'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : q.status === 'sent'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        : q.status === 'declined'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {q.status === 'accepted'
                      ? 'Aceito'
                      : q.status === 'sent'
                      ? 'Enviado'
                      : q.status === 'declined'
                      ? 'Recusado'
                      : q.status === 'draft'
                      ? 'Rascunho'
                      : 'Expirado'}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {q.customerName}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Válido até: {new Date(q.validUntil).toLocaleDateString('pt-PT')}
                </p>

                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Valor Total</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {currencySymbol} {q.total.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Subtotal: {currencySymbol} {q.subtotal.toFixed(2)} (+{q.taxRate}% IVA)
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                <button
                  onClick={() => setPreviewQuote(q)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Ver PDF / Imprimir
                </button>

                <select
                  value={q.status}
                  onChange={(e) => handleStatusChange(q.id, e.target.value as QuoteStatus)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  <option value="draft">Rascunho</option>
                  <option value="sent">Enviado</option>
                  <option value="accepted">Aceito</option>
                  <option value="declined">Recusado</option>
                  <option value="expired">Expirado</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Quote Builder Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Novo Orçamento Comercial"
        subtitle="Adicione itens, defina taxas e gere a proposta para o seu cliente."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateQuote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Selecionar Cliente *
            </label>
            {customers.length === 0 ? (
              <p className="text-xs text-rose-500">
                Ainda não tem clientes cadastrados. Adicione um cliente antes de criar o orçamento.
              </p>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                id="quote-customer-select"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company || 'Pessoa Singular'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Items Table Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Itens / Serviços Incluídos
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    placeholder="Descrição do serviço ou produto..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                    className="w-16 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-center text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                    className="w-24 px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-right text-slate-900 dark:text-white"
                  />
                  <span className="w-20 text-xs font-bold text-right text-slate-800 dark:text-slate-200">
                    {currencySymbol} {(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax and Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Taxa de IVA (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              />

              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 mt-3">
                Validade até
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            <div className="flex flex-col justify-end text-right space-y-1.5 text-xs">
              <p className="text-slate-500">
                Subtotal: <strong>{currencySymbol} {subtotal.toFixed(2)}</strong>
              </p>
              <p className="text-slate-500">
                IVA ({taxRate}%): <strong>{currencySymbol} {taxAmount.toFixed(2)}</strong>
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                Total: {currencySymbol} {grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações & Condições de Pagamento
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="submit-quote-btn"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20"
            >
              Guardar Orçamento
            </button>
          </div>
        </form>
      </Modal>

      {/* PDF Document Preview Modal */}
      {previewQuote && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewQuote(null)}
          title={`Documento de Orçamento: ${previewQuote.quoteNumber}`}
          subtitle="Aparência do PDF para envio ao cliente"
          maxWidth="2xl"
        >
          <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 font-sans shadow-lg space-y-6">
            {/* PDF Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-indigo-900">{workspace?.name}</h2>
                <p className="text-xs text-slate-500 mt-1">NIF: {workspace?.taxId || '123456789'}</p>
                <p className="text-xs text-slate-500">{workspace?.address}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold uppercase tracking-wider text-slate-800 block">
                  ORÇAMENTO
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600 block">
                  {previewQuote.quoteNumber}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Data: {new Date(previewQuote.createdAt).toLocaleDateString('pt-PT')}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Cliente / Destinatário:
              </p>
              <p className="font-semibold text-slate-900 text-sm">{previewQuote.customerName}</p>
              {previewQuote.customerEmail && <p>E-mail: {previewQuote.customerEmail}</p>}
              {previewQuote.customerTaxId && <p>NIF: {previewQuote.customerTaxId}</p>}
            </div>

            {/* Items Table */}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500 uppercase text-[10px]">
                  <th className="py-2">Descrição</th>
                  <th className="py-2 text-center">Qtd</th>
                  <th className="py-2 text-right">Preço Unit.</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewQuote.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-3 font-medium text-slate-800">{it.description}</td>
                    <td className="py-3 text-center text-slate-600">{it.quantity}</td>
                    <td className="py-3 text-right text-slate-600">
                      {currencySymbol} {it.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-900">
                      {currencySymbol} {it.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <div className="w-60 space-y-1 text-xs text-right">
                <p className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {previewQuote.subtotal.toFixed(2)}</span>
                </p>
                <p className="flex justify-between text-slate-600">
                  <span>IVA ({previewQuote.taxRate}%):</span>
                  <span>{currencySymbol} {previewQuote.taxAmount.toFixed(2)}</span>
                </p>
                <p className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-300">
                  <span>Total Final:</span>
                  <span>{currencySymbol} {previewQuote.total.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {previewQuote.notes && (
              <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-4">
                <strong>Condições:</strong> {previewQuote.notes}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-6">
            <span className="text-xs text-slate-400">Pronto para exportação PDF</span>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
