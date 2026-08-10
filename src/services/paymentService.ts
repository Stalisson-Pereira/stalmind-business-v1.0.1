import { PaymentGatewayConfig, AutoBillingRule, PaymentLink } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DEFAULT_CONFIG: PaymentGatewayConfig = {
  mbway: {
    enabled: true,
    phone: '+351 912 345 678',
    key: 'mbw_live_894372948',
  },
  multibanco: {
    enabled: true,
    entity: '12345',
    subEntity: '987',
    antiPhishingKey: 'MB-SECURE-2026',
  },
  stripe: {
    enabled: true,
    publishableKey: 'pk_live_51NxStalmindPaymentKey2026',
    secretKey: 'sk_live_*****',
  },
  bankTransfer: {
    enabled: true,
    iban: 'PT50 0033 0000 1234 5678 9012 3',
    bankName: 'Banco BCP Millennium',
    swiftBic: 'BCOMPTPL',
    accountHolder: 'Stalmind OS Unipessoal Lda',
  },
  paypal: {
    enabled: false,
    email: 'financeiro@stalmind.com',
  },
};

const DEFAULT_AUTO_RULES: AutoBillingRule[] = [
  {
    id: 'abr_01',
    workspaceId: 'ws_01',
    title: 'Manutenção de Website & Servidores',
    customerName: 'Nexus Tech Lda',
    customerEmail: 'contabilidade@nexustech.pt',
    customerPhone: '+351 910 000 111',
    amount: 350,
    frequency: 'monthly',
    nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: 'mbway',
    status: 'active',
    autoSendEmail: true,
    autoSendWhatsApp: true,
    lateFeePercentage: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'abr_02',
    workspaceId: 'ws_01',
    title: 'Retain de Gestão de Redes Sociais & Ads',
    customerName: 'Oliveira & Filhos Studio',
    customerEmail: 'geral@oliveirastudio.pt',
    customerPhone: '+351 961 222 333',
    amount: 750,
    frequency: 'monthly',
    nextBillingDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: 'multibanco',
    status: 'active',
    autoSendEmail: true,
    autoSendWhatsApp: false,
    lateFeePercentage: 1.5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'abr_03',
    workspaceId: 'ws_01',
    title: 'Licenciamento Anual do Software ERP',
    customerName: 'Bloom Arquitetura',
    customerEmail: 'financeiro@bloom.pt',
    amount: 1800,
    frequency: 'yearly',
    nextBillingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    paymentMethod: 'stripe',
    status: 'active',
    autoSendEmail: true,
    autoSendWhatsApp: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_LINKS: PaymentLink[] = [
  {
    id: 'plk_01',
    workspaceId: 'ws_01',
    title: 'Pagamento Adiantado Orçamento #ORC-2026-004',
    amount: 650,
    customerName: 'Santos Logística',
    customerEmail: 'compras@santoslog.pt',
    linkUrl: 'https://pay.stalmind.com/checkout/plk_01',
    status: 'active',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'plk_02',
    workspaceId: 'ws_01',
    title: 'Sessão de Consultoria de IA Individual',
    amount: 150,
    customerName: 'Ana Martins',
    customerEmail: 'ana.martins@gmail.com',
    linkUrl: 'https://pay.stalmind.com/checkout/plk_02',
    status: 'paid',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const CONFIG_STORAGE_KEY = 'stalmind_payment_config';
const RULES_STORAGE_KEY = 'stalmind_auto_billing_rules';
const LINKS_STORAGE_KEY = 'stalmind_payment_links';

export const paymentService = {
  async getGatewayConfig(workspaceId: string): Promise<PaymentGatewayConfig> {
    const raw = localStorage.getItem(`${CONFIG_STORAGE_KEY}_${workspaceId}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CONFIG;
  },

  async saveGatewayConfig(workspaceId: string, config: PaymentGatewayConfig): Promise<void> {
    localStorage.setItem(`${CONFIG_STORAGE_KEY}_${workspaceId}`, JSON.stringify(config));
  },

  async getAutoBillingRules(workspaceId: string): Promise<AutoBillingRule[]> {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_AUTO_RULES));
      return DEFAULT_AUTO_RULES.filter((r) => r.workspaceId === workspaceId);
    }
    try {
      const parsed: AutoBillingRule[] = JSON.parse(raw);
      return parsed.filter((r) => r.workspaceId === workspaceId);
    } catch {
      return DEFAULT_AUTO_RULES;
    }
  },

  async addAutoBillingRule(rule: Omit<AutoBillingRule, 'id' | 'createdAt'>): Promise<AutoBillingRule> {
    const newRule: AutoBillingRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };

    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    const existing: AutoBillingRule[] = raw ? JSON.parse(raw) : DEFAULT_AUTO_RULES;
    const updated = [newRule, ...existing];
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updated));

    return newRule;
  },

  async toggleRuleStatus(id: string, status: 'active' | 'paused' | 'completed'): Promise<void> {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const existing: AutoBillingRule[] = JSON.parse(raw);
      const updated = existing.map((r) => (r.id === id ? { ...r, status } : r));
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  async deleteAutoBillingRule(id: string): Promise<void> {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const existing: AutoBillingRule[] = JSON.parse(raw);
      const updated = existing.filter((r) => r.id !== id);
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  async getPaymentLinks(workspaceId: string): Promise<PaymentLink[]> {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(DEFAULT_LINKS));
      return DEFAULT_LINKS.filter((l) => l.workspaceId === workspaceId);
    }
    try {
      const parsed: PaymentLink[] = JSON.parse(raw);
      return parsed.filter((l) => l.workspaceId === workspaceId);
    } catch {
      return DEFAULT_LINKS;
    }
  },

  async createPaymentLink(link: Omit<PaymentLink, 'id' | 'linkUrl' | 'createdAt'>): Promise<PaymentLink> {
    const id = `plk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newLink: PaymentLink = {
      ...link,
      id,
      linkUrl: `https://pay.stalmind.com/checkout/${id}`,
      createdAt: new Date().toISOString(),
    };

    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    const existing: PaymentLink[] = raw ? JSON.parse(raw) : DEFAULT_LINKS;
    const updated = [newLink, ...existing];
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(updated));

    return newLink;
  },

  async deletePaymentLink(id: string): Promise<void> {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (raw) {
      const existing: PaymentLink[] = JSON.parse(raw);
      const updated = existing.filter((l) => l.id !== id);
      localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(updated));
    }
  },
};
