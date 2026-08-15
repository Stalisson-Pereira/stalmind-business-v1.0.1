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
// AUXILIAR — VERIFICA TRIAL ATIVO
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
// AUXILIAR — IDENTIFICA "TRIAL JÁ ATIVO"
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
          'stalmind_session',
          JSON.stringify(user)
        );

        return user;

      } catch (error) {

        console.warn(
          'Erro ao obter sessão Supabase:',
          error
        );

        return null;
      }
    }

    // ========================================================
    // LOCAL / DEMO
    // ========================================================

    const savedSession =
      localStorage.getItem(
        'stalmind_session'
      );

    if (savedSession) {

      try {

        return JSON.parse(
          savedSession
        );

      } catch (error) {

        console.error(
          'Erro ao ler sessão local:',
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
            'Nenhum usuário autenticado para buscar workspace.'
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
              owner_id,
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
            'Erro ao buscar workspace do usuário:',
            error
          );

          return null;
        }

        if (
          !data ||
          !data.workspaces
        ) {

          console.warn(
            'Usuário não possui workspace associado.'
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
          'stalmind_workspace',
          JSON.stringify(workspace)
        );

        return workspace;

      } catch (error) {

        console.error(
          'Erro inesperado ao buscar workspace:',
          error
        );

        return null;
      }
    }

    // ========================================================
    // LOCAL / DEMO
    // ========================================================

    const saved =
      localStorage.getItem(
        'stalmind_workspace'
      );

    if (saved) {

      try {

        return JSON.parse(
          saved
        );

      } catch (error) {

        console.error(
          'Erro ao ler workspace local:',
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

    // ========================================================
    // PROTEÇÃO LOCAL
    // ========================================================

    const currentWorkspace =
      await this.getCurrentWorkspace();

    if (
      currentWorkspace &&
      hasActiveTrial(currentWorkspace)
    ) {

      console.info(
        '[Stalmind Trial] Trial já está ativo.'
      );

      return false;
    }

    // ========================================================
    // RPC SUPABASE
    // ========================================================

    const {
      error,
    } = await supabase.rpc(
      'start_workspace_trial',
      {
        target_workspace: workspaceId,
      }
    );

    if (error) {

      // ======================================================
      // TRIAL JÁ ATIVO
      // ======================================================

      if (
        isTrialAlreadyActiveError(
          error
        )
      ) {

        console.info(
          '[Stalmind Trial] Workspace já possui trial ativo.'
        );

        return false;
      }

      // ======================================================
      // ERRO REAL
      // ======================================================

      console.error(
        '[Stalmind Trial] Erro real:',
        error
      );

      throw new Error(
        `Não foi possível iniciar o período gratuito: ${error.message}`
      );
    }

    console.info(
      '[Stalmind Trial] Trial iniciado com sucesso.'
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

    // ========================================================
    // URL PARA ONDE O USUÁRIO VOLTARÁ
    // ========================================================

    const redirectTo =
      `${window.location.origin}/reset-password`;

    console.log(
      '[Auth] Solicitando recuperação de senha:',
      {
        email: cleanEmail,
        redirectTo,
      }
    );

    // ========================================================
    // ENVIA E-MAIL PELO SUPABASE
    // ========================================================

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

      console.error(
        '[Auth] Erro ao enviar recuperação:',
        error
      );

      throw new Error(
        `Não foi possível enviar o e-mail de recuperação: ${error.message}`
      );
    }

    console.log(
      '[Auth] Solicitação de recuperação enviada com sucesso.'
    );
  },

  // ============================================================
  // ATUALIZAR NOVA SENHA
  // ============================================================

  async updatePassword(
    newPassword: string
  ): Promise<void> {

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {

      throw new Error(
        'Supabase não está configurado.'
      );
    }

    const password =
      newPassword.trim();

    if (!password) {

      throw new Error(
        'Informe uma nova senha.'
      );
    }

    if (password.length < 6) {

      throw new Error(
        'A nova senha deve ter pelo menos 6 caracteres.'
      );
    }

    console.log(
      '[Auth] Atualizando senha...'
    );

    const {
      error,
    } = await supabase.auth.updateUser({
      password,
    });

    if (error) {

      console.error(
        '[Auth] Erro ao atualizar senha:',
        error
      );

      throw new Error(
        `Não foi possível atualizar a senha: ${error.message}`
      );
    }

    console.log(
      '[Auth] Senha atualizada com sucesso.'
    );
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

      const cleanEmail =
        email.trim().toLowerCase();

      if (!cleanEmail) {

        throw new Error(
          'Informe o e-mail.'
        );
      }

      if (!password) {

        throw new Error(
          'Informe a senha.'
        );
      }

      // ======================================================
      // LOGIN SUPABASE
      // ======================================================

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
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

      // ======================================================
      // BUSCAR WORKSPACE
      // ======================================================

      let workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {

        await supabase.auth.signOut();

        throw new Error(
          'Este usuário não possui um workspace associado.'
        );
      }

      // ======================================================
      // TRIAL
      // ======================================================

      const shouldStartTrial =
        workspace.plan === 'free' &&
        workspace.trialUsed === false &&
        !hasActiveTrial(workspace);

      if (shouldStartTrial) {

        try {

          await this.startTrial(
            workspace.id
          );

          // ==================================================
          // ATUALIZA WORKSPACE
          // ==================================================

          const updatedWorkspace =
            await this.getCurrentWorkspace();

          if (updatedWorkspace) {

            workspace =
              updatedWorkspace;
          }

        } catch (trialError) {

          // ==================================================
          // O TRIAL NUNCA BLOQUEIA O LOGIN
          // ==================================================

          console.warn(
            '[Stalmind Trial] Não foi possível iniciar o trial. Login continuará normalmente.',
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

      // ======================================================
      // SALVAR SESSÃO
      // ======================================================

      localStorage.setItem(
        'stalmind_session',
        JSON.stringify(user)
      );

      localStorage.setItem(
        'stalmind_workspace',
        JSON.stringify(workspace)
      );

      return {
        user,
        workspace,
      };
    }

    // ========================================================
    // LOGIN DEMO
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
      'stalmind_session',
      JSON.stringify(user)
    );

    localStorage.setItem(
      'stalmind_workspace',
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

      const cleanEmail =
        email.trim().toLowerCase();

      if (!cleanEmail) {

        throw new Error(
          'Informe um e-mail válido.'
        );
      }

      if (password.length < 6) {

        throw new Error(
          'A senha deve ter pelo menos 6 caracteres.'
        );
      }

      // ======================================================
      // CRIAR USUÁRIO
      // ======================================================

      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,

          options: {
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

      // ======================================================
      // CONFIRMAÇÃO DE E-MAIL
      // ======================================================

      if (!data.session) {

        return {
          user,
          workspace: null,
          emailConfirmationRequired: true,
        };
      }

      // ======================================================
      // BUSCAR WORKSPACE
      // ======================================================

      let workspace =
        await this.getCurrentWorkspace();

      if (!workspace) {

        throw new Error(
          'Usuário criado, mas nenhum workspace foi associado. Verifique a trigger de criação do workspace no Supabase.'
        );
      }

      // ======================================================
      // TRIAL
      // ======================================================

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
            '[Stalmind Trial] Trial não iniciado durante registro. Cadastro continuará normalmente.',
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

      // ======================================================
      // SALVAR SESSÃO
      // ======================================================

      localStorage.setItem(
        'stalmind_session',
        JSON.stringify(user)
      );

      localStorage.setItem(
        'stalmind_workspace',
        JSON.stringify(workspace)
      );

      return {
        user,
        workspace,
        emailConfirmationRequired: false,
      };
    }

    // ========================================================
    // REGISTRO LOCAL / DEMO
    // ========================================================

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
          .replace(/\s+/g, '-'),

      ownerId:
        user.id,
    };

    localStorage.setItem(
      'stalmind_session',
      JSON.stringify(user)
    );

    localStorage.setItem(
      'stalmind_workspace',
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

    const googleUser: User = {
      ...MOCK_USER,

      id: 'usr_google_01',

      email:
        'usuario.google@stalmind.com',

      name:
        'Usuário Google',
    };

    localStorage.setItem(
      'stalmind_session',
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

        console.error(
          '[Auth] Erro ao terminar sessão:',
          error
        );
      }
    }

    localStorage.removeItem(
      'stalmind_session'
    );

    localStorage.removeItem(
      'stalmind_workspace'
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
          currentWorkspace.role
        );

      localStorage.setItem(
        'stalmind_workspace',
        JSON.stringify(result)
      );

      return result;
    }

    // ========================================================
    // LOCAL
    // ========================================================

    localStorage.setItem(
      'stalmind_workspace',
      JSON.stringify(
        updatedWorkspace
      )
    );

    return updatedWorkspace;
  },
};
