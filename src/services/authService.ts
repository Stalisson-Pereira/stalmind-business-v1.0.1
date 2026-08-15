import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

import {
  User,
  Workspace,
} from '../types';

// ============================================================
// MOCK / DEMO
// ============================================================

const MOCK_USER: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'demo@stalmind.com',
  name: 'Alex Silva',
  avatarUrl:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  phone: '+351 912 345 678',
  jobTitle: 'Consultor & Freelancer',
  createdAt: new Date().toISOString(),
};

const MOCK_WORKSPACE: Workspace = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  name: 'Silva Business Studio',
  slug: 'silva-studio',
  ownerId: '123e4567-e89b-12d3-a456-426614174000',
  taxId: '234567890',
  address: 'Avenida da Liberdade 120, Lisboa',
  email: 'contacto@silvastudio.pt',
  phone: '+351 210 000 111',
  currency: 'EUR',
  defaultTaxRate: 23,

  // NOVO UTILIZADOR COMEÇA SEMPRE NO FREE
  plan: 'free',

  planBilling: undefined,

  createdAt: new Date().toISOString(),

  trialStartedAt: undefined,
  trialEndsAt: undefined,
  trialUsed: false,
};

// ============================================================
// CONSTANTES
// ============================================================

const SESSION_KEY = 'stalmind_session';
const WORKSPACE_KEY = 'stalmind_workspace';

const TRIAL_DAYS = 14;

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type StalmindPlan =
  (typeof PLANS)[keyof typeof PLANS];

// ============================================================
// LIMITES DOS PLANOS
// ============================================================

export const PLAN_LIMITS = {
  free: {
    maxCustomers: 10,
    maxQuotesPerMonth: 5,
    aiMessagesPerMonth: 100,

    paymentLinks: false,
    automaticCollections: false,

    pix: false,
    paypal: false,
    stripe: false,
    sumup: false,

    whatsappReminders: false,
    emailReminders: true,

    financialReports: false,
    advancedFinancialAI: false,

    subAccounts: false,
    permissionsManagement: false,

    customApi: false,
    webhooks: false,

    accountingExport: false,
    dedicatedAccountManager: false,

    prioritySupport: false,
    supportSlaMinutes: null,
  },

  pro: {
    maxCustomers: Infinity,
    maxQuotesPerMonth: Infinity,
    aiMessagesPerMonth: Infinity,

    paymentLinks: true,
    automaticCollections: true,

    pix: true,
    paypal: true,
    stripe: true,
    sumup: true,

    whatsappReminders: true,
    emailReminders: true,

    financialReports: true,
    advancedFinancialAI: false,

    subAccounts: false,
    permissionsManagement: false,

    customApi: false,
    webhooks: false,

    accountingExport: false,
    dedicatedAccountManager: false,

    prioritySupport: true,
    supportSlaMinutes: 24 * 60,
  },

  enterprise: {
    maxCustomers: Infinity,
    maxQuotesPerMonth: Infinity,
    aiMessagesPerMonth: Infinity,

    paymentLinks: true,
    automaticCollections: true,

    pix: true,
    paypal: true,
    stripe: true,
    sumup: true,

    whatsappReminders: true,
    emailReminders: true,

    financialReports: true,
    advancedFinancialAI: true,

    subAccounts: true,
    permissionsManagement: true,

    customApi: true,
    webhooks: true,

    accountingExport: true,
    dedicatedAccountManager: true,

    prioritySupport: true,
    supportSlaMinutes: 60,
  },
} as const;

// ============================================================
// NORMALIZAR PLANO
// ============================================================

function normalizePlan(
  plan?: string | null
): StalmindPlan {
  const value = String(plan || '').toLowerCase();

  if (value === 'enterprise') {
    return PLANS.ENTERPRISE;
  }

  if (value === 'pro') {
    return PLANS.PRO;
  }

  return PLANS.FREE;
}

// ============================================================
// MAP USER
// ============================================================

function mapUser(user: any): User {
  return {
    id: user.id,

    email: user.email || '',

    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Usuário StalMind',

    avatarUrl:
      user.user_metadata?.avatar_url,

    phone:
      user.user_metadata?.phone,

    jobTitle:
      user.user_metadata?.job_title,

    createdAt:
      user.created_at,
  };
}

// ============================================================
// MAP WORKSPACE
// ============================================================

function mapWorkspace(
  workspace: any,
  role?: string
): Workspace {
  return {
    id: workspace.id,

    name: workspace.name,

    slug: workspace.slug,

    ownerId:
      workspace.owner_id || '',

    taxId:
      workspace.tax_id,

    address:
      workspace.address,

    email:
      workspace.email,

    phone:
      workspace.phone,

    currency:
      workspace.currency || 'EUR',

    defaultTaxRate:
      Number(
        workspace.default_tax_rate ?? 23
      ),

    plan:
      normalizePlan(workspace.plan),

    planBilling:
      workspace.plan_billing,

    createdAt:
      workspace.created_at,

    legalName:
      workspace.legal_name,

    website:
      workspace.website,

    city:
      workspace.city,

    postalCode:
      workspace.postal_code,

    country:
      workspace.country,

    locale:
      workspace.locale,

    timezone:
      workspace.timezone,

    logoUrl:
      workspace.logo_url,

    role,

    trialStartedAt:
      workspace.trial_started_at,

    trialEndsAt:
      workspace.trial_ends_at,

    trialUsed:
      workspace.trial_used ?? false,
  } as Workspace;
}

// ============================================================
// TRIAL ATIVO
// ============================================================

function hasActiveTrial(
  workspace: Workspace | null
): boolean {
  if (!workspace) {
    return false;
  }

  if (!workspace.trialEndsAt) {
    return false;
  }

  const trialEnd =
    new Date(
      workspace.trialEndsAt
    ).getTime();

  return (
    !Number.isNaN(trialEnd) &&
    trialEnd > Date.now()
  );
}

// ============================================================
// TRIAL EXPIRADO
// ============================================================

function hasExpiredTrial(
  workspace: Workspace | null
): boolean {
  if (!workspace?.trialEndsAt) {
    return false;
  }

  const trialEnd =
    new Date(
      workspace.trialEndsAt
    ).getTime();

  return (
    !Number.isNaN(trialEnd) &&
    trialEnd <= Date.now()
  );
}

// ============================================================
// PLANO EFETIVO
// ============================================================
//
// Se existe trial ativo, o plano do workspace já deve representar
// o plano escolhido.
//
// Se o trial terminou, o backend deve voltar para FREE.
// ============================================================

export function getEffectivePlan(
  workspace: Workspace | null
): StalmindPlan {
  if (!workspace) {
    return PLANS.FREE;
  }

  return normalizePlan(workspace.plan);
}

// ============================================================
// VERIFICAR RECURSO
// ============================================================

export function hasPlanFeature(
  workspace: Workspace | null,
  feature: keyof typeof PLAN_LIMITS.free
): boolean {
  const plan =
    getEffectivePlan(workspace);

  const limits =
    PLAN_LIMITS[plan];

  const value =
    limits[feature];

  if (typeof value === 'boolean') {
    return value;
  }

  return value !== null && value !== 0;
}

// ============================================================
// VERIFICAR LIMITE
// ============================================================

export function getPlanLimit(
  workspace: Workspace | null,
  limit:
    | 'maxCustomers'
    | 'maxQuotesPerMonth'
    | 'aiMessagesPerMonth'
): number {
  const plan =
    getEffectivePlan(workspace);

  return PLAN_LIMITS[plan][limit];
}

// ============================================================
// ERRO DE TRIAL JÁ UTILIZADO
// ============================================================

function isTrialAlreadyUsedError(
  error: any
): boolean {
  const message =
    String(
      error?.message || ''
    ).toLowerCase();

  return (
    message.includes(
      'trial já utilizado'
    ) ||
    message.includes(
      'trial ja utilizado'
    ) ||
    message.includes(
      'período de teste já utilizado'
    ) ||
    message.includes(
      'periodo de teste ja utilizado'
    ) ||
    message.includes(
      'trial_used'
    )
  );
}

// ============================================================
// ERRO DE TRIAL ATIVO
// ============================================================

function isTrialAlreadyActiveError(
  error: any
): boolean {
  const message =
    String(
      error?.message || ''
    ).toLowerCase();

  return (
    error?.code === 'P0001' &&
    (
      message.includes('já possui') ||
      message.includes('ja possui') ||
      message.includes('trial') &&
      message.includes('ativo') ||
      message.includes('período de teste ativo') ||
      message.includes('periodo de teste ativo')
    )
  );
}

// ============================================================
// VALIDAR PLANO DE TRIAL
// ============================================================

function validateTrialPlan(
  plan: string
): StalmindPlan {
  const normalized =
    normalizePlan(plan);

  if (
    normalized !== PLANS.PRO &&
    normalized !== PLANS.ENTERPRISE
  ) {
    throw new Error(
      'O período de teste gratuito está disponível apenas para os planos Pro e Enterprise.'
    );
  }

  return normalized;
}

// ============================================================
// AUTH SERVICE
// ============================================================

export const authService = {

  // ============================================================
  // USUÁRIO ATUAL
  // ============================================================

  async getCurrentUser(): Promise<User | null> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (!session?.user) {
          return null;
        }

        const user =
          mapUser(
            session.user
          );

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify(user)
        );

        return user;

      } catch {
        return null;
      }
    }

    const savedSession =
      localStorage.getItem(
        SESSION_KEY
      );

    if (savedSession) {
      try {
        return JSON.parse(
          savedSession
        );
      } catch {
        localStorage.removeItem(
          SESSION_KEY
        );
      }
    }

    return MOCK_USER;
  },

  // ============================================================
  // WORKSPACE ATUAL
  // ============================================================

  async getCurrentWorkspace(): Promise<Workspace | null> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {
      try {

        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        const user =
          session?.user;

        if (!user) {
          return null;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from('workspace_members')
            .select(`
              role,
              workspace_id,
              workspaces (
                id,
                name,
                legal_name,
                tax_id,
                email,
                phone,
                website,
                address,
                city,
                postal_code,
                country,
                currency,
                locale,
                timezone,
                logo_url,
                created_at,
                updated_at,
                slug,
                default_tax_rate,
                plan,
                plan_billing,
                trial_started_at,
                trial_ends_at,
                trial_used
              )
            `)
            .eq(
              'user_id',
              user.id
            )
            .limit(1)
            .maybeSingle();

        if (error) {
          return null;
        }

        if (
          !data ||
          !data.workspaces
        ) {
          return null;
        }

        const workspaceData =
          Array.isArray(
            data.workspaces
          )
            ? data.workspaces[0]
            : data.workspaces;

        if (!workspaceData) {
          return null;
        }

        const workspace =
          mapWorkspace(
            workspaceData,
            data.role
          );

        localStorage.setItem(
          WORKSPACE_KEY,
          JSON.stringify(workspace)
        );

        return workspace;

      } catch {
        return null;
      }
    }

    const saved =
      localStorage.getItem(
        WORKSPACE_KEY
      );

    if (saved) {
      try {
        return JSON.parse(
          saved
        );
      } catch {
        localStorage.removeItem(
          WORKSPACE_KEY
        );
      }
    }

    return MOCK_WORKSPACE;
  },

  // ============================================================
  // INICIAR TRIAL DE UM PLANO
  // ============================================================

  async startTrial(
    workspaceId: string,
    selectedPlan: 'pro' | 'enterprise'
  ): Promise<boolean> {

    if (!workspaceId) {
      throw new Error(
        'Workspace inválido para iniciar o período de teste.'
      );
    }

    const plan =
      validateTrialPlan(
        selectedPlan
      );

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      return false;
    }

    const {
      data: {
        session,
      },
    } =
      await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error(
        'Usuário não autenticado.'
      );
    }

    const currentWorkspace =
      await this.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    // ----------------------------------------------------------
    // NÃO PERMITIR NOVO TRIAL
    // ----------------------------------------------------------

    if (
      currentWorkspace.trialUsed
    ) {
      throw new Error(
        'Este workspace já utilizou o período de teste gratuito.'
      );
    }

    // ----------------------------------------------------------
    // NÃO PERMITIR DOIS TRIALS
    // ----------------------------------------------------------

    if (
      hasActiveTrial(
        currentWorkspace
      )
    ) {
      return false;
    }

    // ----------------------------------------------------------
    // RPC
    // ----------------------------------------------------------
    //
    // A RPC deve:
    //
    // 1. confirmar que o usuário pertence ao workspace
    // 2. confirmar que trial_used = false
    // 3. confirmar que não existe trial ativo
    // 4. alterar plan para o plano escolhido
    // 5. definir trial_started_at = NOW()
    // 6. definir trial_ends_at = NOW() + 14 dias
    // 7. definir trial_used = true
    //
    // ----------------------------------------------------------

    const {
      error,
    } =
      await supabase.rpc(
        'start_workspace_trial',
        {
          target_workspace:
            workspaceId,

          selected_plan:
            plan,
        }
      );

    if (error) {

      if (
        isTrialAlreadyActiveError(
          error
        )
      ) {
        return false;
      }

      if (
        isTrialAlreadyUsedError(
          error
        )
      ) {
        throw new Error(
          'Este workspace já utilizou o período de teste gratuito.'
        );
      }

      throw new Error(
        `Não foi possível iniciar o período de teste: ${error.message}`
      );
    }

    return true;
  },

  // ============================================================
  // ESCOLHER PLANO E INICIAR TRIAL
  // ============================================================

  async selectPlan(
    selectedPlan:
      | 'pro'
      | 'enterprise'
  ): Promise<Workspace> {

    const plan =
      validateTrialPlan(
        selectedPlan
      );

    const workspace =
      await this.getCurrentWorkspace();

    if (!workspace) {
      throw new Error(
        'Nenhum workspace encontrado.'
      );
    }

    // ----------------------------------------------------------
    // FREE
    // ----------------------------------------------------------

    if (
      workspace.plan === PLANS.FREE &&
      workspace.trialUsed === false
    ) {

      await this.startTrial(
        workspace.id,
        plan
      );

      const updated =
        await this.getCurrentWorkspace();

      if (!updated) {
        throw new Error(
          'Não foi possível atualizar o plano do workspace.'
        );
      }

      return updated;
    }

    // ----------------------------------------------------------
    // TRIAL JÁ USADO
    // ----------------------------------------------------------

    if (
      workspace.trialUsed
    ) {
      throw new Error(
        'O período de teste gratuito já foi utilizado. Para utilizar este plano novamente, é necessário realizar o pagamento.'
      );
    }

    // ----------------------------------------------------------
    // JÁ POSSUI PLANO
    // ----------------------------------------------------------

    throw new Error(
      'Não é possível alterar o plano desta forma. Utilize o processo de pagamento.'
    );
  },

  // ============================================================
  // EXPIRAÇÃO DO TRIAL
  // ============================================================
  //
  // Esta função é apenas uma sincronização.
  //
  // A segurança REAL deve estar no banco/RPC.
  //
  // Quando o trial termina:
  //
  // Pro/Enterprise -> Free
  //
  // ------------------------------------------------------------

  async syncTrialStatus(): Promise<Workspace | null> {

    const workspace =
      await this.getCurrentWorkspace();

    if (!workspace) {
      return null;
    }

    if (
      !hasExpiredTrial(
        workspace
      )
    ) {
      return workspace;
    }

    if (
      workspace.plan === PLANS.FREE
    ) {
      return workspace;
    }

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      return workspace;
    }

    const {
      error,
    } =
      await supabase.rpc(
        'expire_workspace_trial',
        {
          target_workspace:
            workspace.id,
        }
      );

    if (error) {
      throw new Error(
        `Não foi possível finalizar o período de teste: ${error.message}`
      );
    }

    const updated =
      await this.getCurrentWorkspace();

    return updated;
  },

  // ============================================================
  // RECUPERAÇÃO DE SENHA
  // ============================================================

  async resetPassword(
    email: string
  ): Promise<void> {

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      throw new Error(
        'Supabase não está configurado.'
      );
    }

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      throw new Error(
        'Informe um e-mail válido.'
      );
    }

    const redirectTo =
      `${window.location.origin}/reset-password`;

    const {
      error,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

    if (error) {
      throw new Error(
        error.message ||
        'Não foi possível enviar o e-mail de recuperação.'
      );
    }
  },

  // ============================================================
  // LOGIN
  // ============================================================

  async login(
    email: string,
    password: string
  ): Promise<{
    user: User;
    workspace: Workspace;
  }> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email
                .trim()
                .toLowerCase(),

            password,
          });

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data.user) {
        throw new Error(
          'Usuário não encontrado após login.'
        );
      }

      const user =
        mapUser(
          data.user
        );

      let workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {

        await supabase.auth.signOut();

        throw new Error(
          'Este usuário não possui um workspace associado.'
        );
      }

      // --------------------------------------------------------
      // VERIFICAR TRIAL EXPIRADO
      // --------------------------------------------------------

      workspace =
        await this.syncTrialStatus() ||
        workspace;

      // --------------------------------------------------------
      // SESSÃO
      // --------------------------------------------------------

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(user)
      );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(workspace)
      );

      return {
        user,
        workspace,
      };
    }

    // ----------------------------------------------------------
    // LOGIN DEMO
    // ----------------------------------------------------------

    const user: User = {
      ...MOCK_USER,

      email:
        email ||
        MOCK_USER.email,

      name:
        email
          ? email
              .split('@')[0]
              .toUpperCase()
          : MOCK_USER.name,
    };

    const workspace =
      MOCK_WORKSPACE;

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(user)
    );

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(workspace)
    );

    return {
      user,
      workspace,
    };
  },

  // ============================================================
  // REGISTRO
  // ============================================================

  async register(
    name: string,
    company: string,
    email: string,
    password: string
  ): Promise<{
    user: User;
    workspace: Workspace | null;
    emailConfirmationRequired?: boolean;
  }> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email:
            email
              .trim()
              .toLowerCase(),

          password,

          options: {
            emailRedirectTo:
              `${window.location.origin}/`,

            data: {
              full_name: name,
              company_name: company,
            },
          },
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!data.user) {
        throw new Error(
          'Não foi possível criar o usuário.'
        );
      }

      const user =
        mapUser(
          data.user
        );

      // --------------------------------------------------------
      // CONFIRMAÇÃO DE EMAIL
      // --------------------------------------------------------

      if (!data.session) {

        return {
          user,
          workspace: null,
          emailConfirmationRequired: true,
        };
      }

      // --------------------------------------------------------
      // WORKSPACE
      // --------------------------------------------------------

      const workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {

        throw new Error(
          'Usuário criado, mas nenhum workspace foi associado. Verifique a trigger de criação do workspace no Supabase.'
        );
      }

      // --------------------------------------------------------
      // IMPORTANTE
      // --------------------------------------------------------
      //
      // NÃO INICIAMOS TRIAL AQUI.
      //
      // O usuário começa em FREE.
      //
      // O trial só começa quando selecionar
      // explicitamente Pro ou Enterprise.
      //
      // --------------------------------------------------------

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(user)
      );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(workspace)
      );

      return {
        user,
        workspace,
        emailConfirmationRequired: false,
      };
    }

    // ----------------------------------------------------------
    // REGISTRO LOCAL / DEMO
    // ----------------------------------------------------------

    const user: User = {
      id:
        crypto.randomUUID(),

      email,

      name,

      createdAt:
        new Date().toISOString(),
    };

    const slug =
      (company || `${name} Workspace`)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(
          /[^a-z0-9-]/g,
          ''
        );

    const workspace: Workspace = {
      ...MOCK_WORKSPACE,

      id:
        crypto.randomUUID(),

      name:
        company ||
        `${name} Workspace`,

      slug,

      ownerId:
        user.id,

      // SEMPRE FREE
      plan:
        PLANS.FREE,

      trialStartedAt:
        undefined,

      trialEndsAt:
        undefined,

      trialUsed:
        false,
    };

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(user)
    );

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(workspace)
    );

    return {
      user,
      workspace,
      emailConfirmationRequired: false,
    };
  },

  // ============================================================
  // GOOGLE OAUTH
  // ============================================================

  async loginWithGoogle(): Promise<void> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        error,
      } =
        await supabase.auth
          .signInWithOAuth({
            provider: 'google',

            options: {
              redirectTo:
                window.location.origin,
            },
          });

      if (error) {
        throw new Error(
          error.message
        );
      }

      return;
    }

    // ----------------------------------------------------------
    // GOOGLE DEMO
    // ----------------------------------------------------------

    const googleUser: User = {
      ...MOCK_USER,

      id:
        'usr_google_01',

      email:
        'usuario.google@stalmind.com',

      name:
        'Usuário Google',
    };

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(
        googleUser
      )
    );
  },

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(): Promise<void> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        error,
      } =
        await supabase.auth
          .signOut();

      if (error) {
        throw new Error(
          error.message
        );
      }
    }

    localStorage.removeItem(
      SESSION_KEY
    );

    localStorage.removeItem(
      WORKSPACE_KEY
    );
  },

  // ============================================================
  // ATUALIZAR WORKSPACE
  // ============================================================

  async updateWorkspace(
    data: Partial<Workspace>
  ): Promise<Workspace> {

    const currentWorkspace =
      await this.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error(
        'Nenhum workspace encontrado.'
      );
    }

    const updatedWorkspace: Workspace = {
      ...currentWorkspace,
      ...data,
    };

    // ----------------------------------------------------------
    // PROTEGER PLANO
    // ----------------------------------------------------------
    //
    // Não permitir que updateWorkspace seja utilizado
    // para transformar Free em Pro/Enterprise.
    //
    // A alteração de plano deve acontecer através de:
    //
    // selectPlan()
    // ou
    // processo de pagamento.
    //
    // ----------------------------------------------------------

    if (
      data.plan &&
      normalizePlan(
        data.plan
      ) !==
        normalizePlan(
          currentWorkspace.plan
        )
    ) {

      throw new Error(
        'A alteração de plano deve ser realizada através do processo de seleção de plano ou pagamento.'
      );
    }

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        data: updated,
        error,
      } =
        await supabase
          .from('workspaces')
          .update({

            name:
              updatedWorkspace.name,

            legal_name:
              updatedWorkspace.legalName,

            tax_id:
              updatedWorkspace.taxId,

            email:
              updatedWorkspace.email,

            phone:
              updatedWorkspace.phone,

            website:
              updatedWorkspace.website,

            address:
              updatedWorkspace.address,

            city:
              updatedWorkspace.city,

            postal_code:
              updatedWorkspace.postalCode,

            country:
              updatedWorkspace.country,

            currency:
              updatedWorkspace.currency,

            locale:
              updatedWorkspace.locale,

            timezone:
              updatedWorkspace.timezone,

            logo_url:
              updatedWorkspace.logoUrl,

            slug:
              updatedWorkspace.slug,

            default_tax_rate:
              updatedWorkspace.defaultTaxRate,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            currentWorkspace.id
          )
          .select()
          .single();

      if (error) {
        throw new Error(
          `Erro ao atualizar workspace: ${error.message}`
        );
      }

      const result =
        mapWorkspace(
          updated,
          currentWorkspace.role
        );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(result)
      );

      return result;
    }

    // ----------------------------------------------------------
    // LOCAL
    // ----------------------------------------------------------

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(
        updatedWorkspace
      )
    );

    return updatedWorkspace;
  },
};
