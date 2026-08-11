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

const DEFAULT_AUTO_RULES: AutoBillingRule[] = [];

const DEFAULT_LINKS: PaymentLink[] = [];

const CONFIG_STORAGE_KEY = 'stalmind_payment_config';
const RULES_STORAGE_KEY = 'stalmind_v2_auto_billing_rules';
const LINKS_STORAGE_KEY = 'stalmind_v2_payment_links';

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
      id: crypto.randomUUID(),
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
    const id = crypto.randomUUID();
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
