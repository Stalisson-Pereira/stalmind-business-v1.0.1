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
  ownerId: MOCK_USER.id,
  taxId: '234567890',
  address: 'Avenida da Liberdade 120, Lisboa',
  email: 'contacto@silvastudio.pt',
  phone: '+351 210 000 111',
  currency: 'EUR',
  defaultTaxRate: 23,
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
  const value = String(plan || '')
    .trim()
    .toLowerCase();

  if (value === PLANS.ENTERPRISE) {
    return PLANS.ENTERPRISE;
  }

  if (value === PLANS.PRO) {
    return PLANS.PRO;
  }

  return PLANS.FREE;
}

// ============================================================
// VALIDAR UUID
// ============================================================

function isValidUUID(
  value?: string | null
): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// ============================================================
// MAP USER
// ============================================================

function mapUser(
  user: any
): User {
  return {
    id: user.id,

    email:
      user.email || '',

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
  role?: string,
  ownerId?: string
): Workspace {
  return {
    id:
      workspace.id,

    name:
      workspace.name || '',

    slug:
      workspace.slug || '',

    ownerId:
      ownerId || '',

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
      normalizePlan(
        workspace.plan
      ),

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
  if (!workspace?.trialEndsAt) {
    return false;
  }

  const timestamp =
    new Date(
      workspace.trialEndsAt
    ).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp > Date.now()
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

  const timestamp =
    new Date(
      workspace.trialEndsAt
    ).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp <= Date.now()
  );
}

// ============================================================
// PLANO EFETIVO
// ============================================================

export function getEffectivePlan(
  workspace: Workspace | null
): StalmindPlan {
  if (!workspace) {
    return PLANS.FREE;
  }

  return normalizePlan(
    workspace.plan
  );
}

// ============================================================
// VERIFICAR RECURSO
// ============================================================

export function hasPlanFeature(
  workspace: Workspace | null,
  feature: keyof typeof PLAN_LIMITS.free
): boolean {
  const plan =
    getEffectivePlan(
      workspace
    );

  const value =
    PLAN_LIMITS[plan][feature];

  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'number'
  ) {
    return (
      value > 0 ||
      value === Infinity
    );
  }

  return false;
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
    getEffectivePlan(
      workspace
    );

  return PLAN_LIMITS[plan][limit];
}

// ============================================================
// ERRO TRIAL UTILIZADO
// ============================================================

function isTrialAlreadyUsedError(
  error: any
): boolean {
  const message =
    String(
      error?.message || ''
    ).toLowerCase();

  return (
    message.includes('trial já utilizado') ||
    message.includes('trial ja utilizado') ||
    message.includes('período de teste já utilizado') ||
    message.includes('periodo de teste ja utilizado') ||
    message.includes('trial_used')
  );
}

// ============================================================
// ERRO TRIAL ATIVO
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
      (
        message.includes('já possui') ||
        message.includes('ja possui')
      ) &&
      message.includes('trial')
      ||
      (
        message.includes('trial') &&
        message.includes('ativo')
      ) ||
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
    normalizePlan(
      plan
    );

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

  // ==========================================================
  // USUÁRIO ATUAL
  // ==========================================================

  async getCurrentUser(): Promise<User | null> {
    try {

      // ------------------------------------------------------
      // MODO DEMO / LOCAL
      // ------------------------------------------------------

      if (
        !isSupabaseConfigured ||
        !supabase
      ) {
        const saved =
          localStorage.getItem(
            SESSION_KEY
          );

        if (!saved) {
          return MOCK_USER;
        }

        try {
          return JSON.parse(
            saved
          ) as User;
        } catch {
          localStorage.removeItem(
            SESSION_KEY
          );

          return MOCK_USER;
        }
      }

      // ------------------------------------------------------
      // PRIMEIRO VERIFICAR SESSION
      // ------------------------------------------------------

      const {
        data,
        error,
      } =
        await supabase.auth.getSession();

      if (error) {
        console.warn(
          '[authService] Não foi possível obter a sessão:',
          error.message
        );

        return null;
      }

      // ------------------------------------------------------
      // SEM LOGIN = NORMAL
      // NÃO É ERRO
      // ------------------------------------------------------

      if (!data.session?.user) {
        return null;
      }

      return mapUser(
        data.session.user
      );

    } catch (error) {

      console.warn(
        '[authService] Falha ao verificar usuário:',
        error
      );

      return null;
    }
  },

  // ==========================================================
  // WORKSPACE ATUAL
  // ==========================================================

  async getCurrentWorkspace(): Promise<Workspace | null> {
    try {

      // ======================================================
      // SUPABASE
      // ======================================================

      if (
        isSupabaseConfigured &&
        supabase
      ) {

        // ----------------------------------------------------
        // OBTER SESSÃO
        // ----------------------------------------------------

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.warn(
            '[authService] Erro ao obter sessão:',
            sessionError.message
          );

          return null;
        }

        const user =
          sessionData.session?.user;

        // ----------------------------------------------------
        // SEM SESSÃO
        // ----------------------------------------------------

        if (!user) {
          return null;
        }

        // ----------------------------------------------------
        // BUSCAR MEMBRO
        // ----------------------------------------------------
        //
        // NÃO USAMOS workspaces(owner_id)
        // NÃO USAMOS workspaces(*)
        //
        // O relacionamento é resolvido manualmente.
        // ----------------------------------------------------

        const {
          data: member,
          error: memberError,
        } =
          await supabase
            .from('workspace_members')
            .select(
              `
                user_id,
                workspace_id,
                role
              `
            )
            .eq(
              'user_id',
              user.id
            )
            .limit(1)
            .maybeSingle();

        if (memberError) {
          console.error(
            '[authService] Erro ao buscar workspace_members:',
            memberError
          );

          return null;
        }

        if (!member) {
          console.warn(
            '[authService] Usuário não possui workspace associado:',
            user.id
          );

          return null;
        }

        // ----------------------------------------------------
        // VALIDAR WORKSPACE ID
        // ----------------------------------------------------

        if (
          !isValidUUID(
            member.workspace_id
          )
        ) {
          console.error(
            '[authService] workspace_id inválido:',
            member.workspace_id
          );

          return null;
        }

        // ----------------------------------------------------
        // BUSCAR WORKSPACE
        // ----------------------------------------------------
        //
        // ATENÇÃO:
        // owner_id NÃO EXISTE NA SUA TABELA.
        //
        // Portanto NÃO está no SELECT.
        // ----------------------------------------------------

        const {
          data: workspaceData,
          error: workspaceError,
        } =
          await supabase
            .from('workspaces')
            .select(
              `
                id,
                name,
                slug,
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
                default_tax_rate,
                plan,
                plan_billing,
                trial_started_at,
                trial_ends_at,
                trial_used,
                created_at,
                updated_at
              `
            )
            .eq(
              'id',
              member.workspace_id
            )
            .maybeSingle();

        if (workspaceError) {
          console.error(
            '[authService] Erro ao buscar workspace:',
            workspaceError
          );

          return null;
        }

        if (!workspaceData) {
          console.warn(
            '[authService] Workspace não encontrado:',
            member.workspace_id
          );

          return null;
        }

        // ----------------------------------------------------
        // BUSCAR OWNER ATRAVÉS DE workspace_members
        // ----------------------------------------------------

        let ownerId: string | undefined;

        if (
          member.role === 'owner'
        ) {
          ownerId =
            member.user_id;

        } else {

          const {
            data: ownerMember,
            error: ownerError,
          } =
            await supabase
              .from('workspace_members')
              .select(
                `
                  user_id
                `
              )
              .eq(
                'workspace_id',
                member.workspace_id
              )
              .eq(
                'role',
                'owner'
              )
              .limit(1)
              .maybeSingle();

          if (ownerError) {
            console.warn(
              '[authService] Não foi possível obter o proprietário:',
              ownerError
            );
          }

          ownerId =
            ownerMember?.user_id;
        }

        // ----------------------------------------------------
        // MAPEAR WORKSPACE
        // ----------------------------------------------------

        const workspace =
          mapWorkspace(
            workspaceData,
            member.role,
            ownerId
          );

        // ----------------------------------------------------
        // CACHE LOCAL
        // ----------------------------------------------------

        localStorage.setItem(
          WORKSPACE_KEY,
          JSON.stringify(
            workspace
          )
        );

        return workspace;
      }

      // ======================================================
      // LOCAL / DEMO
      // ======================================================

      const saved =
        localStorage.getItem(
          WORKSPACE_KEY
        );

      if (saved) {

        try {

          return JSON.parse(
            saved
          ) as Workspace;

        } catch {

          localStorage.removeItem(
            WORKSPACE_KEY
          );
        }
      }

      return MOCK_WORKSPACE;

    } catch (error) {

      console.error(
        '[authService] Erro inesperado ao carregar workspace:',
        error
      );

      return null;
    }
  },

  // ==========================================================
  // LOGIN
  // ==========================================================

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
        await supabase.auth.signInWithPassword({
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

      // ------------------------------------------------------
      // SINCRONIZAR TRIAL
      // ------------------------------------------------------

      workspace =
        await this.syncTrialStatus() ||
        workspace;

      // ------------------------------------------------------
      // SALVAR SESSÃO
      // ------------------------------------------------------

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(
          user
        )
      );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(
          workspace
        )
      );

      return {
        user,
        workspace,
      };
    }

    // ========================================================
    // DEMO
    // ========================================================

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
      JSON.stringify(
        user
      )
    );

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(
        workspace
      )
    );

    return {
      user,
      workspace,
    };
  },

  // ==========================================================
  // REGISTRO
  // ==========================================================

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

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email:
            cleanEmail,

          password,

          options: {
            emailRedirectTo:
              window.location.origin,

            data: {
              full_name:
                name,

              company_name:
                company,
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

      // ------------------------------------------------------
      // CONFIRMAÇÃO DE EMAIL
      // ------------------------------------------------------

      if (!data.session) {

        return {
          user,
          workspace: null,
          emailConfirmationRequired:
            true,
        };
      }

      // ------------------------------------------------------
      // WORKSPACE
      // ------------------------------------------------------

      const workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {

        throw new Error(
          'Usuário criado, mas nenhum workspace foi associado. Verifique a criação do workspace no Supabase.'
        );
      }

      // ------------------------------------------------------
      // NOVO USUÁRIO = FREE
      // ------------------------------------------------------

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(
          user
        )
      );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(
          workspace
        )
      );

      return {
        user,
        workspace,
        emailConfirmationRequired:
          false,
      };
    }

    // ========================================================
    // DEMO
    // ========================================================

    const user: User = {
      id:
        crypto.randomUUID(),

      email,

      name,

      createdAt:
        new Date().toISOString(),
    };

    const slug =
      (
        company ||
        `${name} Workspace`
      )
        .toLowerCase()
        .trim()
        .replace(
          /\s+/g,
          '-'
        )
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
      JSON.stringify(
        user
      )
    );

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(
        workspace
      )
    );

    return {
      user,
      workspace,
      emailConfirmationRequired:
        false,
    };
  },

  // ==========================================================
  // GOOGLE
  // ==========================================================

  async loginWithGoogle(): Promise<void> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        error,
      } =
        await supabase.auth.signInWithOAuth({
          provider:
            'google',

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

    const googleUser: User = {
      ...MOCK_USER,

      id:
        '123e4567-e89b-12d3-a456-426614174001',

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

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async logout(): Promise<void> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        error,
      } =
        await supabase.auth.signOut();

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

  // ==========================================================
  // START TRIAL
  // ==========================================================

  async startTrial(
    workspaceId: string,
    selectedPlan: 'pro' | 'enterprise'
  ): Promise<boolean> {

    // ==========================================================
    // VALIDAR WORKSPACE
    // ==========================================================

    if (
      !workspaceId ||
      !isValidUUID(workspaceId)
    ) {
      throw new Error(
        'O ID do workspace não é um UUID válido.'
      );
    }


    // ==========================================================
    // VALIDAR PLANO
    // ==========================================================

    const plan =
      validateTrialPlan(
        selectedPlan
      );


    // ==========================================================
    // SUPABASE
    // ==========================================================

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      throw new Error(
        'Supabase não está configurado.'
      );
    }


    // ==========================================================
    // VERIFICAR SESSÃO
    // ==========================================================

    const {
      data: {
        session
      },
      error: sessionError
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        '[authService] Erro ao obter sessão:',
        sessionError
      );

      throw new Error(
        'Não foi possível verificar sua sessão.'
      );
    }

    if (!session?.user) {
      throw new Error(
        'Usuário não autenticado. Faça login novamente.'
      );
    }


    // ==========================================================
    // CONFIRMAR WORKSPACE
    // ==========================================================

    const currentWorkspace =
      await this.getCurrentWorkspace();

    if (!currentWorkspace) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }


    if (
      currentWorkspace.id !==
      workspaceId
    ) {
      throw new Error(
        'O workspace informado não corresponde ao workspace do usuário autenticado.'
      );
    }


    // ==========================================================
    // TRIAL JÁ UTILIZADO
    // ==========================================================

    if (
      currentWorkspace.trialUsed
    ) {
      throw new Error(
        'Este workspace já utilizou o período de teste gratuito.'
      );
    }


    // ==========================================================
    // TRIAL ATIVO
    // ==========================================================

    if (
      hasActiveTrial(
        currentWorkspace
      )
    ) {
      return false;
    }


    // ==========================================================
    // GARANTIR FREE
    // ==========================================================

    if (
      normalizePlan(
        currentWorkspace.plan
      ) !== PLANS.FREE
    ) {
      throw new Error(
        'O workspace já possui um plano diferente de Free.'
      );
    }


    // ==========================================================
    // RPC
    // ==========================================================

    const {
      data,
      error
    } =
      await supabase.rpc(
        'start_workspace_trial',
        {
          target_workspace:
            workspaceId,

          selected_plan:
            plan
        }
      );


    // ==========================================================
    // ERRO RPC
    // ==========================================================

    if (error) {

      console.error(
        '[authService] Erro start_workspace_trial:',
        error
      );


      if (
        error.code === '42501'
      ) {
        throw new Error(
          'Você não possui permissão para iniciar o período de teste deste workspace.'
        );
      }


      if (
        error.code === 'PGRST202'
      ) {
        throw new Error(
          'A função start_workspace_trial não foi encontrada no Supabase. Execute o SQL de correção.'
        );
      }


      const message =
        String(
          error.message || ''
        ).toLowerCase();


      if (
        message.includes(
          'já foi utilizado'
        ) ||
        message.includes(
          'ja foi utilizado'
        ) ||
        message.includes(
          'trial_used'
        )
      ) {
        throw new Error(
          'Este workspace já utilizou o período de teste gratuito.'
        );
      }


      if (
        message.includes(
          'período de teste ativo'
        ) ||
        message.includes(
          'periodo de teste ativo'
        )
      ) {
        return false;
      }


      if (
        message.includes(
          'não pertence'
        ) ||
        message.includes(
          'nao pertence'
        )
      ) {
        throw new Error(
          'Você não possui acesso a este workspace.'
        );
      }


      throw new Error(
        error.message ||
        'Não foi possível iniciar o período de teste.'
      );
    }


    // ==========================================================
    // CONFIRMAR RETORNO
    // ==========================================================

    if (
      !data ||
      data.success !== true
    ) {
      throw new Error(
        'O período de teste não foi confirmado pelo servidor.'
      );
    }


    // ==========================================================
    // SUCESSO
    // ==========================================================

    return true;
  },

  // ==========================================================
  // SELECIONAR PLANO
  // ==========================================================

  async selectPlan(
    selectedPlan:
      | 'pro'
      | 'enterprise'
  ): Promise<Workspace> {

    // ==========================================================
    // VALIDAR PLANO
    // ==========================================================

    const plan =
      validateTrialPlan(
        selectedPlan
      );


    // ==========================================================
    // BUSCAR WORKSPACE
    // ==========================================================

    const workspace =
      await this.getCurrentWorkspace();


    if (!workspace) {
      throw new Error(
        'Nenhum workspace encontrado.'
      );
    }


    // ==========================================================
    // FREE + TRIAL DISPONÍVEL
    // ==========================================================

    if (
      normalizePlan(
        workspace.plan
      ) === PLANS.FREE &&
      workspace.trialUsed === false
    ) {

      const started =
        await this.startTrial(
          workspace.id,
          plan
        );


      if (!started) {
        throw new Error(
          'Não foi possível iniciar o período de teste.'
        );
      }


      // --------------------------------------------------------
      // RECARREGAR DO BANCO
      // --------------------------------------------------------

      const updated =
        await this.getCurrentWorkspace();


      if (!updated) {
        throw new Error(
          'O período de teste foi iniciado, mas não foi possível atualizar o workspace.'
        );
      }


      return updated;
    }


    // ==========================================================
    // TRIAL JÁ USADO
    // ==========================================================

    if (
      workspace.trialUsed
    ) {
      throw new Error(
        'O período de teste gratuito já foi utilizado. Para continuar com este plano, é necessário realizar o pagamento.'
      );
    }


    // ==========================================================
    // OUTRO CASO
    // ==========================================================

    throw new Error(
      `Não é possível iniciar o plano ${plan} desta forma. Utilize o processo de pagamento.`
    );
  },

  // ==========================================================
  // SINCRONIZAR TRIAL
  // ==========================================================

  async syncTrialStatus(): Promise<Workspace | null> {

    // ==========================================================
    // BUSCAR WORKSPACE
    // ==========================================================

    const workspace =
      await this.getCurrentWorkspace();


    if (!workspace) {
      return null;
    }


    // ==========================================================
    // TRIAL AINDA NÃO EXPIROU
    // ==========================================================

    if (
      !hasExpiredTrial(
        workspace
      )
    ) {
      return workspace;
    }


    // ==========================================================
    // JÁ ESTÁ NO FREE
    // ==========================================================

    if (
      normalizePlan(
        workspace.plan
      ) === PLANS.FREE
    ) {
      return workspace;
    }


    // ==========================================================
    // DEMO
    // ==========================================================

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      return workspace;
    }


    // ==========================================================
    // VALIDAR UUID
    // ==========================================================

    if (
      !isValidUUID(
        workspace.id
      )
    ) {
      throw new Error(
        'O ID do workspace não é um UUID válido.'
      );
    }


    // ==========================================================
    // EXPIRAR TRIAL
    // ==========================================================

    const {
      error
    } =
      await supabase.rpc(
        'expire_workspace_trial',
        {
          target_workspace:
            workspace.id
        }
      );


    if (error) {

      console.error(
        '[authService] Erro expire_workspace_trial:',
        error
      );


      if (
        error.code === '42501'
      ) {
        throw new Error(
          'Você não possui permissão para finalizar o período de teste deste workspace.'
        );
      }


      if (
        error.code === 'PGRST202'
      ) {
        throw new Error(
          'A função expire_workspace_trial não foi encontrada no Supabase.'
        );
      }


      throw new Error(
        error.message ||
        'Não foi possível finalizar o período de teste.'
      );
    }


    // ==========================================================
    // RECARREGAR
    // ==========================================================

    return this.getCurrentWorkspace();
  },

  // ==========================================================
  // RESET PASSWORD
  // ==========================================================

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
      await supabase.auth.resetPasswordForEmail(
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

  // ==========================================================
  // SET PASSWORD
  // ==========================================================

  async setPassword(
    password: string
  ): Promise<void> {

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      throw new Error(
        'Supabase não está configurado.'
      );
    }

    if (
      !password ||
      password.length < 6
    ) {
      throw new Error(
        'A senha deve ter pelo menos 6 caracteres.'
      );
    }

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !sessionData.session
    ) {
      throw new Error(
        'A sessão de recuperação não está disponível ou expirou.'
      );
    }

    const {
      error,
    } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      throw new Error(
        error.message ||
        'Não foi possível alterar a senha.'
      );
    }
  },

  // ==========================================================
  // ATUALIZAR WORKSPACE
  // ==========================================================

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

    // --------------------------------------------------------
    // PROTEGER ID
    // --------------------------------------------------------

    if (
      data.id &&
      data.id !==
      currentWorkspace.id
    ) {
      throw new Error(
        'Não é permitido alterar o ID do workspace.'
      );
    }

    // --------------------------------------------------------
    // PROTEGER OWNER
    // --------------------------------------------------------

    if (
      data.ownerId &&
      data.ownerId !==
      currentWorkspace.ownerId
    ) {
      throw new Error(
        'Não é permitido alterar o proprietário do workspace.'
      );
    }

    // --------------------------------------------------------
    // PROTEGER PLANO
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // PROTEGER TRIAL
    // --------------------------------------------------------

    if (
      data.trialUsed !== undefined &&
      data.trialUsed !==
      currentWorkspace.trialUsed
    ) {
      throw new Error(
        'O status do período de teste só pode ser alterado pelo backend.'
      );
    }

    if (
      data.trialStartedAt !== undefined &&
      data.trialStartedAt !==
      currentWorkspace.trialStartedAt
    ) {
      throw new Error(
        'A data de início do trial só pode ser alterada pelo backend.'
      );
    }

    if (
      data.trialEndsAt !== undefined &&
      data.trialEndsAt !==
      currentWorkspace.trialEndsAt
    ) {
      throw new Error(
        'A data de término do trial só pode ser alterada pelo backend.'
      );
    }

    const updatedWorkspace: Workspace = {
      ...currentWorkspace,
      ...data,
    };

    // ========================================================
    // SUPABASE
    // ========================================================

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
          currentWorkspace.role,
          currentWorkspace.ownerId
        );

      localStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify(
          result
        )
      );

      return result;
    }

    // ========================================================
    // LOCAL / DEMO
    // ========================================================

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(
        updatedWorkspace
      )
    );

    return updatedWorkspace;
  },
};