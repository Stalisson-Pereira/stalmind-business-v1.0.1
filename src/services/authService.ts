import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { User, Workspace } from '../types';

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
  plan: 'Pro',
  planBilling: 'monthly',
  createdAt: new Date().toISOString(),
};

// ============================================================
// CONSTANTES
// ============================================================

const SESSION_KEY = 'stalmind_session';
const WORKSPACE_KEY = 'stalmind_workspace';

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
    avatarUrl: user.user_metadata?.avatar_url,
    phone: user.user_metadata?.phone,
    jobTitle: user.user_metadata?.job_title,
    createdAt: user.created_at,
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
    ownerId: workspace.owner_id || '',

    taxId: workspace.tax_id,
    address: workspace.address,
    email: workspace.email,
    phone: workspace.phone,

    currency: workspace.currency || 'EUR',

    defaultTaxRate: Number(
      workspace.default_tax_rate ?? 23
    ),

    plan: workspace.plan || 'free',
    planBilling: workspace.plan_billing,

    createdAt: workspace.created_at,

    legalName: workspace.legal_name,
    website: workspace.website,
    city: workspace.city,
    postalCode: workspace.postal_code,
    country: workspace.country,
    locale: workspace.locale,
    timezone: workspace.timezone,
    logoUrl: workspace.logo_url,

    role,

    trialStartedAt: workspace.trial_started_at,
    trialEndsAt: workspace.trial_ends_at,

    trialUsed:
      workspace.trial_used ?? false,
  } as Workspace;
}

// ============================================================
// TRIAL — VERIFICA SE ESTÁ ATIVO
// ============================================================

function hasActiveTrial(
  workspace: Workspace | null
): boolean {
  if (!workspace) {
    return false;
  }

  if (workspace.trialEndsAt) {
    const trialEnd = new Date(
      workspace.trialEndsAt
    ).getTime();

    if (
      !Number.isNaN(trialEnd) &&
      trialEnd > Date.now()
    ) {
      return true;
    }
  }

  if (
    workspace.trialStartedAt &&
    !workspace.trialEndsAt
  ) {
    return true;
  }

  return false;
}

// ============================================================
// TRIAL — IDENTIFICA ERRO DE TRIAL JÁ ATIVO
// ============================================================

function isTrialAlreadyActiveError(
  error: any
): boolean {
  const message = String(
    error?.message || ''
  ).toLowerCase();

  return (
    error?.code === 'P0001' &&
    (
      message.includes('já possui') ||
      message.includes('periodo de teste ativo') ||
      message.includes('período de teste ativo') ||
      (
        message.includes('trial') &&
        message.includes('ativo')
      )
    )
  );
}

// ============================================================
// AUTH SERVICE
// ============================================================

export const authService = {
  // ============================================================
  // USUÁRIO ATUAL
  // ============================================================

  async getCurrentUser(): Promise<User | null> {
    // ----------------------------------------------------------
    // SUPABASE
    // ----------------------------------------------------------

    if (
      isSupabaseConfigured &&
      supabase
    ) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          return null;
        }

        const user = mapUser(
          session.user
        );

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify(user)
        );

        return user;
      } catch (error) {
        console.warn(
          '[Auth] Erro ao obter sessão Supabase:',
          error
        );

        return null;
      }
    }

    // ----------------------------------------------------------
    // LOCAL / DEMO
    // ----------------------------------------------------------

    const savedSession =
      localStorage.getItem(
        SESSION_KEY
      );

    if (savedSession) {
      try {
        return JSON.parse(
          savedSession
        );
      } catch (error) {
        console.error(
          '[Auth] Erro ao ler sessão local:',
          error
        );
      }
    }

    return MOCK_USER;
  },

  // ============================================================
  // WORKSPACE ATUAL
  // ============================================================

  async getCurrentWorkspace(): Promise<Workspace | null> {
    // ----------------------------------------------------------
    // SUPABASE
    // ----------------------------------------------------------

    if (
      isSupabaseConfigured &&
      supabase
    ) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;

        if (!user) {
          console.warn(
            '[Workspace] Nenhum usuário autenticado.'
          );

          return null;
        }

        const {
          data,
          error,
        } = await supabase
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
          console.error(
            '[Workspace] Erro ao buscar workspace:',
            error
          );

          return null;
        }

        if (
          !data ||
          !data.workspaces
        ) {
          console.warn(
            '[Workspace] Usuário não possui workspace associado.'
          );

          return null;
        }

        const workspaceData =
          Array.isArray(data.workspaces)
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
      } catch (error) {
        console.error(
          '[Workspace] Erro inesperado:',
          error
        );

        return null;
      }
    }

    // ----------------------------------------------------------
    // LOCAL / DEMO
    // ----------------------------------------------------------

    const saved =
      localStorage.getItem(
        WORKSPACE_KEY
      );

    if (saved) {
      try {
        return JSON.parse(
          saved
        );
      } catch (error) {
        console.error(
          '[Workspace] Erro ao ler workspace local:',
          error
        );
      }
    }

    return MOCK_WORKSPACE;
  },

  // ============================================================
  // INICIAR TRIAL
  // ============================================================

  async startTrial(
    workspaceId: string
  ): Promise<boolean> {
    if (!workspaceId) {
      throw new Error(
        'Workspace inválido para iniciar o trial.'
      );
    }

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      return false;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error(
        'Usuário não autenticado para iniciar o trial.'
      );
    }

    // ----------------------------------------------------------
    // PROTEÇÃO LOCAL
    // ----------------------------------------------------------

    const currentWorkspace =
      await this.getCurrentWorkspace();

    if (
      currentWorkspace &&
      hasActiveTrial(currentWorkspace)
    ) {
      console.info(
        '[StalMind Trial] Trial já está ativo.'
      );

      return false;
    }

    // ----------------------------------------------------------
    // RPC
    // ----------------------------------------------------------

    const {
      error,
    } = await supabase.rpc(
      'start_workspace_trial',
      {
        target_workspace:
          workspaceId,
      }
    );

    // ----------------------------------------------------------
    // ERRO
    // ----------------------------------------------------------

    if (error) {
      if (
        isTrialAlreadyActiveError(
          error
        )
      ) {
        console.info(
          '[StalMind Trial] O workspace já possui um trial ativo.'
        );

        return false;
      }

      console.error(
        '[StalMind Trial] Erro real:',
        error
      );

      throw new Error(
        `Não foi possível iniciar o período gratuito: ${error.message}`
      );
    }

    console.info(
      '[StalMind Trial] Trial iniciado com sucesso.'
    );

    return true;
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
      email.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error(
        'Informe um e-mail válido.'
      );
    }

    const redirectTo =
      `${window.location.origin}/reset-password`;

    console.log(
      '================================='
    );

    console.log(
      '[RESET PASSWORD] INÍCIO'
    );

    console.log(
      '[RESET PASSWORD] Email:',
      cleanEmail
    );

    console.log(
      '[RESET PASSWORD] Origin:',
      window.location.origin
    );

    console.log(
      '[RESET PASSWORD] Redirect:',
      redirectTo
    );

    console.log(
      '================================='
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      console.log(
        '[RESET PASSWORD] DATA:',
        data
      );

      console.log(
        '[RESET PASSWORD] ERROR:',
        error
      );

      if (error) {
        console.error(
          '[RESET PASSWORD] ERRO DO SUPABASE:',
          error
        );

        throw new Error(
          error.message ||
          'Não foi possível enviar o e-mail de recuperação.'
        );
      }

      console.log(
        '[RESET PASSWORD] SOLICITAÇÃO ACEITA PELO SUPABASE'
      );
    } catch (error: any) {
      console.error(
        '[RESET PASSWORD] ERRO FINAL:',
        error
      );

      throw new Error(
        error?.message ||
        'Erro ao solicitar recuperação de senha.'
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
    // ----------------------------------------------------------
    // SUPABASE
    // ----------------------------------------------------------

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
            email.trim().toLowerCase(),
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
        mapUser(data.user);

      let workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {
        await supabase.auth.signOut();

        throw new Error(
          'Este usuário não possui um workspace associado.'
        );
      }

      // --------------------------------------------------------
      // TRIAL
      // --------------------------------------------------------

      const shouldStartTrial =
        workspace.plan === 'free' &&
        workspace.trialUsed === false &&
        !hasActiveTrial(workspace);

      if (shouldStartTrial) {
        try {
          await this.startTrial(
            workspace.id
          );

          const updatedWorkspace =
            await this.getCurrentWorkspace();

          if (updatedWorkspace) {
            workspace =
              updatedWorkspace;
          }
        } catch (trialError) {
          console.warn(
            '[StalMind Trial] Não foi possível iniciar o trial. Login continuará normalmente.',
            trialError
          );

          const refreshedWorkspace =
            await this.getCurrentWorkspace();

          if (refreshedWorkspace) {
            workspace =
              refreshedWorkspace;
          }
        }
      }

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

      name: email
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
    // ----------------------------------------------------------
    // SUPABASE
    // ----------------------------------------------------------

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
            email.trim().toLowerCase(),

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
        mapUser(data.user);

      // --------------------------------------------------------
      // CONFIRMAÇÃO DE EMAIL
      // --------------------------------------------------------

      if (!data.session) {
        console.info(
          '[Auth] Cadastro criado. Aguardando confirmação de e-mail.'
        );

        return {
          user,
          workspace: null,
          emailConfirmationRequired: true,
        };
      }

      // --------------------------------------------------------
      // WORKSPACE
      // --------------------------------------------------------

      let workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {
        throw new Error(
          'Usuário criado, mas nenhum workspace foi associado. Verifique a trigger de criação do workspace no Supabase.'
        );
      }

      // --------------------------------------------------------
      // TRIAL
      // --------------------------------------------------------

      const shouldStartTrial =
        workspace.plan === 'free' &&
        workspace.trialUsed === false &&
        !hasActiveTrial(workspace);

      if (shouldStartTrial) {
        try {
          await this.startTrial(
            workspace.id
          );

          const updatedWorkspace =
            await this.getCurrentWorkspace();

          if (updatedWorkspace) {
            workspace =
              updatedWorkspace;
          }
        } catch (trialError) {
          console.warn(
            '[StalMind Trial] Trial não iniciado durante registro. Cadastro continuará normalmente.',
            trialError
          );

          const refreshedWorkspace =
            await this.getCurrentWorkspace();

          if (refreshedWorkspace) {
            workspace =
              refreshedWorkspace;
          }
        }
      }

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
        emailConfirmationRequired: false,
      };
    }

    // ----------------------------------------------------------
    // REGISTRO LOCAL / DEMO
    // ----------------------------------------------------------

    const user: User = {
      id: crypto.randomUUID(),
      email,
      name,
      createdAt:
        new Date().toISOString(),
    };

    const workspace: Workspace = {
      ...MOCK_WORKSPACE,

      id: crypto.randomUUID(),

      name:
        company ||
        `${name} Workspace`,

      slug:
        company
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, ''),

      ownerId:
        user.id,
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
  // GOOGLE
  // ============================================================

  async loginWithGoogle(): Promise<void> {
    if (
      isSupabaseConfigured &&
      supabase
    ) {
      const {
        error,
      } =
        await supabase.auth.signInWithOAuth({
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

      id: 'usr_google_01',

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
        await supabase.auth.signOut();

      if (error) {
        console.warn(
          '[Auth] Erro ao fazer logout Supabase:',
          error
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
    // SUPABASE
    // ----------------------------------------------------------

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
