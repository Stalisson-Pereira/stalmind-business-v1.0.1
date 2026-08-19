// ============================================================
// STALMIND BUSINESS OS
// TYPES - CENTRAL TYPE DEFINITIONS
// ============================================================

// ============================================================
// AUTH / USER
// ============================================================

export type Role =
  | 'owner'
  | 'admin'
  | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  createdAt: string;
}

export type StalmindPlan =
  | 'free'
  | 'pro'
  | 'enterprise';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;

  // Dados da empresa
  legalName?: string;
  taxId?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;

  // Configurações
  currency: Currency;
  locale?: Language;
  timezone?: string;
  defaultTaxRate: number;

  // Plano
  plan?: StalmindPlan;
  planBilling?: 'monthly' | 'annually';

  // Trial
  trialUsed?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;

  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
}

// ============================================================
// CUSTOMER
// ============================================================

export type CustomerStatus =
  | 'active'
  | 'lead'
  | 'inactive';

export type CustomerType =
  | 'individual'
  | 'company';

export interface Customer {
  id: string;

  workspace_id: string;

  type: CustomerType;

  name: string;

  company_name: string;

  email: string;

  phone: string;

  mobile: string;

  tax_id: string;

  address: string;

  city: string;

  postal_code: string;

  country: string;

  notes: string;

  is_active: boolean;

  status?: CustomerStatus;

  created_by?: string | null;

  created_at: string;

  updated_at?: string | null;

  // ----------------------------------------------------------
  // Compatibilidade com código antigo
  // ----------------------------------------------------------

  workspaceId?: string;

  company?: string;

  taxId?: string;
}

// ============================================================
// QUOTES
// ============================================================

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;

  workspaceId: string;

  customerId: string;

  customerName: string;

  customerEmail?: string;

  customerTaxId?: string;

  customerAddress?: string;

  quoteNumber: string;

  items: QuoteItem[];

  subtotal: number;

  taxRate: number;

  taxAmount: number;

  total: number;

  status: QuoteStatus;

  validUntil: string;

  notes?: string;

  createdAt: string;
}

// ============================================================
// MESSAGES
// ============================================================

export type MessageCategory =
  | 'quote'
  | 'billing'
  | 'thanks'
  | 'followup'
  | 'scheduling'
  | 'confirmation';

export interface MessageTemplate {
  id: string;

  category: MessageCategory;

  title: string;

  content: string;
}

export interface Message {
  id: string;

  workspaceId: string;

  customerId?: string;

  customerName: string;

  customerEmail?: string;

  customerPhone?: string;

  category: MessageCategory;

  title: string;

  content: string;

  status:
    | 'draft'
    | 'sent';

  createdAt: string;
}

// ============================================================
// AI
// ============================================================

export interface AIChatMessage {
  id: string;

  role:
    | 'user'
    | 'model';

  content: string;

  timestamp: string;
}

// ============================================================
// THEME / LANGUAGE / CURRENCY
// ============================================================

export type Theme =
  | 'light'
  | 'dark'
  | 'system';

export type Language =
  | 'pt'
  | 'en'
  | 'es'
  | 'fr';

export type Currency =
  | 'EUR'
  | 'USD'
  | 'BRL';

// ============================================================
// FINANCIAL
// ============================================================

export type TransactionType =
  | 'income'
  | 'expense';

export type TransactionStatus =
  | 'paid'
  | 'pending'
  | 'overdue';

export type TransactionCategory =
  | 'Vendas & Serviços'
  | 'Consultoria'
  | 'Marketing & Anúncios'
  | 'Software & Ferramentas'
  | 'Instalações & Aluguer'
  | 'Salários & Equipa'
  | 'Impostos & Taxas'
  | 'Outros';

export interface FinancialTransaction {
  id: string;

  workspaceId: string;

  type: TransactionType;

  title: string;

  amount: number;

  category:
    | TransactionCategory
    | string;

  status: TransactionStatus;

  date: string;

  dueDate?: string;

  customerOrSupplier?: string;

  paymentMethod?: string;

  notes?: string;

  createdAt: string;
}

// ============================================================
// PAYMENTS
// ============================================================

export interface PaymentGatewayConfig {
  mbway: {
    enabled: boolean;
    phone: string;
    key?: string;
  };

  multibanco: {
    enabled: boolean;
    entity: string;
    subEntity: string;
    antiPhishingKey?: string;
  };

  stripe: {
    enabled: boolean;
    publishableKey: string;
    secretKey?: string;
  };

  bankTransfer: {
    enabled: boolean;
    iban: string;
    bankName: string;
    swiftBic?: string;
    accountHolder: string;
  };

  paypal: {
    enabled: boolean;
    email: string;
  };
}

export interface AutoBillingRule {
  id: string;

  workspaceId: string;

  title: string;

  customerName: string;

  customerEmail: string;

  customerPhone?: string;

  amount: number;

  frequency:
    | 'monthly'
    | 'quarterly'
    | 'yearly';

  nextBillingDate: string;

  paymentMethod:
    | 'mbway'
    | 'multibanco'
    | 'stripe'
    | 'bank_transfer'
    | 'sepa';

  status:
    | 'active'
    | 'paused'
    | 'completed';

  autoSendEmail: boolean;

  autoSendWhatsApp: boolean;

  lateFeePercentage?: number;

  createdAt: string;
}

export interface PaymentLink {
  id: string;

  workspaceId: string;

  title: string;

  amount: number;

  customerName: string;

  customerEmail?: string;

  linkUrl: string;

  status:
    | 'active'
    | 'paid'
    | 'expired';

  expiresAt?: string;

  createdAt: string;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export interface AppNotification {
  id: string;

  title: string;

  message: string;

  type:
    | 'payment'
    | 'quote'
    | 'message'
    | 'system'
    | 'billing';

  read: boolean;

  createdAt: string;

  link?: string;
}