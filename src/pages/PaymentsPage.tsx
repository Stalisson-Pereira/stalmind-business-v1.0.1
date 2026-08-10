import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { paymentService } from '../services/paymentService';
import { PaymentGatewayConfig, AutoBillingRule, PaymentLink } from '../types';
import { Modal } from '../components/common/Modal';
import {
  CreditCard,
  QrCode,
  Building,
  Smartphone,
  Repeat,
  Link as LinkIcon,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Trash2,
  Copy,
  ExternalLink,
  Settings,
  ShieldCheck,
  Zap,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Loader2,
  DollarSign,
  Check,
  Percent,
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const { workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<'autobilling' | 'gateways' | 'links'>('autobilling');

  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Data
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>({
    mbway: { enabled: true, phone: '' },
    multibanco: { enabled: true, entity: '', subEntity: '' },
    stripe: { enabled: true, publishableKey: '' },
    bankTransfer: { enabled: true, iban: '', bankName: '', accountHolder: '' },
    paypal: { enabled: false, email: '' },
  });

  const [autoRules, setAutoRules] = useState<AutoBillingRule[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);

  // Modals
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // New Rule Form
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleCustomerName, setRuleCustomerName] = useState('');
  const [ruleCustomerEmail, setRuleCustomerEmail] = useState('');
  const [ruleCustomerPhone, setRuleCustomerPhone] = useState('');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [ruleNextDate, setRuleNextDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [ruleMethod, setRuleMethod] = useState<'mbway' | 'multibanco' | 'stripe' | 'bank_transfer' | 'sepa'>('mbway');
  const [ruleSendEmail, setRuleSendEmail] = useState(true);
  const [ruleSendWhatsApp, setRuleSendWhatsApp] = useState(true);
  const [ruleLateFee, setRuleLateFee] = useState('2');

  // New Link Form
  const [linkTitle, setLinkTitle] = useState('');
  const [linkAmount, setLinkAmount] = useState('');
  const [linkCustomerName, setLinkCustomerName] = useState('');
  const [linkCustomerEmail, setLinkCustomerEmail] = useState('');
  const [linkExpiresAt, setLinkExpiresAt] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const currencySymbol = workspace?.currency === 'BRL' ? 'R$' : workspace?.currency === 'USD' ? '$' : '€';

  useEffect(() => {
    loadData();
  }, [workspace]);

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const cfg = await paymentService.getGatewayConfig(workspace.id);
      const rules = await paymentService.getAutoBillingRules(workspace.id);
      const links = await paymentService.getPaymentLinks(workspace.id);

      setGatewayConfig(cfg);
      setAutoRules(rules);
      setPaymentLinks(links);
    } catch (err) {
      console.error('Error loading payment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    try {
      await paymentService.saveGatewayConfig(workspace.id, gatewayConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving gateways:', err);
    }
  };

  const handleCreateAutoRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !ruleTitle || !ruleAmount) return;

    const numAmount = parseFloat(ruleAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      await paymentService.addAutoBillingRule({
        workspaceId: workspace.id,
        title: ruleTitle,
        customerName: ruleCustomerName,
        customerEmail: ruleCustomerEmail,
        customerPhone: ruleCustomerPhone || undefined,
        amount: numAmount,
        frequency: ruleFrequency,
        nextBillingDate: ruleNextDate,
        paymentMethod: ruleMethod,
        status: 'active',
        autoSendEmail: ruleSendEmail,
        autoSendWhatsApp: ruleSendWhatsApp,
        lateFeePercentage: ruleLateFee ? parseFloat(ruleLateFee) : undefined,
      });

      setIsRuleModalOpen(false);
      resetRuleForm();
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const resetRuleForm = () => {
    setRuleTitle('');
    setRuleCustomerName('');
    setRuleCustomerEmail('');
    setRuleCustomerPhone('');
    setRuleAmount('');
    setRuleFrequency('monthly');
    setRuleNextDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setRuleMethod('mbway');
    setRuleSendEmail(true);
    setRuleSendWhatsApp(true);
    setRuleLateFee('2');
  };

  const handleToggleRuleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    await paymentService.toggleRuleStatus(id, nextStatus);
    await loadData();
  };

  const handleDeleteRule = async (id: string) => {
    if (window.confirm('Tem a certeza que deseja eliminar esta cobrança automática?')) {
      await paymentService.deleteAutoBillingRule(id);
      await loadData();
    }
  };

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !linkTitle || !linkAmount) return;

    const numAmount = parseFloat(linkAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    try {
      await paymentService.createPaymentLink({
        workspaceId: workspace.id,
        title: linkTitle,
        amount: numAmount,
        customerName: linkCustomerName,
        customerEmail: linkCustomerEmail || undefined,
        status: 'active',
        expiresAt: linkExpiresAt || undefined,
      });

      setIsLinkModalOpen(false);
      setLinkTitle('');
      setLinkAmount('');
      setLinkCustomerName('');
      setLinkCustomerEmail('');
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (window.confirm('Eliminar este link de pagamento?')) {
      await paymentService.deletePaymentLink(id);
      await loadData();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <span>Pagamentos & Cobrança Automática</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure métodos de recebimento (MB WAY, Multibanco, Stripe) e automatize cobranças recorrentes aos seus clientes.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('autobilling')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'autobilling'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Cobrança Automática</span>
          </button>
          <button
            onClick={() => setActiveTab('gateways')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'gateways'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gateways / Métodos</span>
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'links'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Links Rápidos</span>
          </button>
        </div>
      </div>

      {/* TAB 1: COBRANÇA AUTOMÁTICA */}
      {activeTab === 'autobilling' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Feature Banner */}
          <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800/50 shadow-md text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3 text-indigo-400" />
                <span>Cobrança Inteligente Sem Stress</span>
              </div>
              <h3 className="text-lg font-bold">Automatize Mensalidades e Recorrências</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                O Stalmind envia notificações automáticas via WhatsApp e E-mail com referências MB WAY / Multibanco e links Stripe antes do vencimento. Receba sem precisar de cobrar manualmente.
              </p>
            </div>

            <button
              onClick={() => {
                resetRuleForm();
                setIsRuleModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Cobrança Recorrente</span>
            </button>
          </div>

          {/* Active Auto-Billing Rules List */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Repeat className="w-4 h-4 text-indigo-500" />
                <span>Regras de Cobrança Ativas ({autoRules.length})</span>
              </h4>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs">A carregar regras de cobrança...</span>
              </div>
            ) : autoRules.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sem cobranças automáticas ativas</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adicione contratos mensais, avenças de manutenção ou subscrições de clientes.
                </p>
                <button
                  onClick={() => setIsRuleModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Cobrança</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {autoRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">{rule.title}</h5>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            rule.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {rule.status === 'active' ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{rule.customerName}</span>
                        <span>•</span>
                        <span className="capitalize">
                          Frequência: {rule.frequency === 'monthly' ? 'Mensal' : rule.frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
                        </span>
                        <span>•</span>
                        <span className="uppercase">Método: {rule.paymentMethod.replace('_', ' ')}</span>
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                        {rule.autoSendEmail && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Mail className="w-3 h-3" /> E-mail Automático
                          </span>
                        )}
                        {rule.autoSendWhatsApp && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <MessageSquare className="w-3 h-3" /> WhatsApp Ativo
                          </span>
                        )}
                        {rule.lateFeePercentage && (
                          <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                            <Percent className="w-3 h-3" /> +{rule.lateFeePercentage}% Juros de mora
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                      <div className="text-left md:text-right">
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {rule.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Próxima cobrança: <span className="font-semibold text-indigo-500">{rule.nextBillingDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleRuleStatus(rule.id, rule.status)}
                          title={rule.status === 'active' ? 'Pausar Cobrança' : 'Ativar Cobrança'}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          {rule.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Eliminar Cobrança"
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GATEWAYS DE PAGAMENTO */}
      {activeTab === 'gateways' && (
        <form onSubmit={handleSaveGatewayConfig} className="space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Credenciais e Métodos de Recebimento</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ative e configure os meios de pagamento disponibilizados aos seus clientes nas faturas e links.
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{savedSuccess ? 'Guardado com Sucesso!' : 'Guardar Alterações'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MB WAY */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold text-xs">
                    MB
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">MB WAY</h5>
                    <p className="text-[11px] text-slate-500">Cobrança direta para telemóvel em Portugal</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={gatewayConfig.mbway.enabled}
                  onChange={(e) =>
                    setGatewayConfig({
                      ...gatewayConfig,
                      mbway: { ...gatewayConfig.mbway, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {gatewayConfig.mbway.enabled && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Número de Telemóvel MB WAY
                    </label>
                    <input
                      type="text"
                      placeholder="+351 912 345 678"
                      value={gatewayConfig.mbway.phone}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          mbway: { ...gatewayConfig.mbway, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Chave API / Sub-entidade (Ifthenpay / EuPago)
                    </label>
                    <input
                      type="password"
                      placeholder="mbw_live_xxxxxxxx"
                      value={gatewayConfig.mbway.key || ''}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          mbway: { ...gatewayConfig.mbway, key: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Multibanco */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">Referências Multibanco</h5>
                    <p className="text-[11px] text-slate-500">Geração automática de Entidade & Sub-entidade</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={gatewayConfig.multibanco.enabled}
                  onChange={(e) =>
                    setGatewayConfig({
                      ...gatewayConfig,
                      multibanco: { ...gatewayConfig.multibanco, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {gatewayConfig.multibanco.enabled && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Entidade (Ex: 12345)
                    </label>
                    <input
                      type="text"
                      placeholder="12345"
                      value={gatewayConfig.multibanco.entity}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          multibanco: { ...gatewayConfig.multibanco, entity: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Sub-entidade / Chave
                    </label>
                    <input
                      type="text"
                      placeholder="987"
                      value={gatewayConfig.multibanco.subEntity}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          multibanco: { ...gatewayConfig.multibanco, subEntity: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stripe (Cartões & SEPA) */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">Stripe Checkout</h5>
                    <p className="text-[11px] text-slate-500">Cartões de crédito internacionais, Apple Pay, Google Pay</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={gatewayConfig.stripe.enabled}
                  onChange={(e) =>
                    setGatewayConfig({
                      ...gatewayConfig,
                      stripe: { ...gatewayConfig.stripe, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {gatewayConfig.stripe.enabled && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Stripe Publishable Key
                    </label>
                    <input
                      type="text"
                      placeholder="pk_live_..."
                      value={gatewayConfig.stripe.publishableKey}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          stripe: { ...gatewayConfig.stripe, publishableKey: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Transferência Bancária / NIB / IBAN */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 dark:text-white">Transferência Bancária (IBAN)</h5>
                    <p className="text-[11px] text-slate-500">Dados impressos nas faturas e propostas</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={gatewayConfig.bankTransfer.enabled}
                  onChange={(e) =>
                    setGatewayConfig({
                      ...gatewayConfig,
                      bankTransfer: { ...gatewayConfig.bankTransfer, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {gatewayConfig.bankTransfer.enabled && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      IBAN
                    </label>
                    <input
                      type="text"
                      placeholder="PT50 0000 0000 0000 0000 0000 0"
                      value={gatewayConfig.bankTransfer.iban}
                      onChange={(e) =>
                        setGatewayConfig({
                          ...gatewayConfig,
                          bankTransfer: { ...gatewayConfig.bankTransfer, iban: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Banco
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Millennium BCP"
                        value={gatewayConfig.bankTransfer.bankName}
                        onChange={(e) =>
                          setGatewayConfig({
                            ...gatewayConfig,
                            bankTransfer: { ...gatewayConfig.bankTransfer, bankName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Titular da Conta
                      </label>
                      <input
                        type="text"
                        placeholder="Empresa Lda"
                        value={gatewayConfig.bankTransfer.accountHolder}
                        onChange={(e) =>
                          setGatewayConfig({
                            ...gatewayConfig,
                            bankTransfer: { ...gatewayConfig.bankTransfer, accountHolder: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: LINKS RÁPIDOS DE PAGAMENTO */}
      {activeTab === 'links' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Gerador de Links de Pagamento</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crie um link de checkout direto para enviar por WhatsApp, SMS ou e-mail.
              </p>
            </div>
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Gerar Novo Link</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {paymentLinks.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <LinkIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum link gerado</p>
                <p className="text-xs text-slate-500 mt-1">Crie um link de checkout direto para cobrar um cliente rapidamente.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paymentLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-slate-900 dark:text-white">{link.title}</h5>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            link.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                          }`}
                        >
                          {link.status === 'paid' ? 'Pago' : 'Ativo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Cliente: <span className="font-semibold">{link.customerName}</span></p>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          readOnly
                          value={link.linkUrl}
                          className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 w-64 select-all"
                        />
                        <button
                          onClick={() => copyToClipboard(link.linkUrl, link.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLinkId === link.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-5">
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {link.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                        </div>
                        {link.expiresAt && <div className="text-[10px] text-slate-400">Validade: {link.expiresAt}</div>}
                      </div>

                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CRIAR REGRA DE COBRANÇA AUTOMÁTICA */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title="Configurar Cobrança Automática Recorrente"
      >
        <form onSubmit={handleCreateAutoRule} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título do Serviço / Contrato *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Avença Mensal de Design, Servidores Web..."
              value={ruleTitle}
              onChange={(e) => setRuleTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Nexus Tech Lda"
                value={ruleCustomerName}
                onChange={(e) => setRuleCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail para Envio da Cobrança *
              </label>
              <input
                type="email"
                required
                placeholder="cliente@empresa.com"
                value={ruleCustomerEmail}
                onChange={(e) => setRuleCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Recorrente ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={ruleAmount}
                onChange={(e) => setRuleAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Frequência
              </label>
              <select
                value={ruleFrequency}
                onChange={(e) => setRuleFrequency(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Próxima Cobrança
              </label>
              <input
                type="date"
                value={ruleNextDate}
                onChange={(e) => setRuleNextDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Método de Cobrança Sugerido
              </label>
              <select
                value={ruleMethod}
                onChange={(e) => setRuleMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="mbway">MB WAY (Telemóvel)</option>
                <option value="multibanco">Referência Multibanco</option>
                <option value="stripe">Cartão de Crédito / Stripe</option>
                <option value="bank_transfer">Transferência Bancária / IBAN</option>
                <option value="sepa">Débito Direto SEPA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Juros de Mora em Atraso (%)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="2%"
                value={ruleLateFee}
                onChange={(e) => setRuleLateFee(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Automations Toggles */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Automações de Notificação
            </span>
            <div className="flex flex-col sm:flex-row gap-4 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={ruleSendEmail}
                  onChange={(e) => setRuleSendEmail(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enviar aviso por E-mail</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={ruleSendWhatsApp}
                  onChange={(e) => setRuleSendWhatsApp(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enviar lembrete via WhatsApp</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsRuleModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
            >
              Ativar Cobrança
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CRIAR LINK DE PAGAMENTO */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Gerar Link de Checkout Rápidos"
      >
        <form onSubmit={handleCreatePaymentLink} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição do Serviço / Produto *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pagamento de Sinal de Projeto"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

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
                value={linkAmount}
                onChange={(e) => setLinkAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Validade do Link
              </label>
              <input
                type="date"
                value={linkExpiresAt}
                onChange={(e) => setLinkExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pedro Santos"
              value={linkCustomerName}
              onChange={(e) => setLinkCustomerName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
            >
              Gerar Link
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
