import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  User,
  Workspace,
} from '../types';

import {
  authService,
} from '../services/authService';

import {
  supabase,
} from '../lib/supabaseClient';

/* ============================================================
   TIPOS
============================================================ */

interface RegisterResult {
  emailConfirmationRequired?: boolean;
  user?: User | null;
  workspace?: Workspace | null;
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;

  login: (
    email: string,
    pass: string
  ) => Promise<void>;

  register: (
    name: string,
    company: string,
    email: string,
    pass: string
  ) => Promise<{
    emailConfirmationRequired?: boolean;
  }>;

  loginWithGoogle: () => Promise<void>;

  logout: () => Promise<void>;

  updateWorkspace: (
    data: Partial<Workspace>
  ) => Promise<void>;
}

/* ============================================================
   CONTEXT
============================================================ */

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

/* ============================================================
   PROVIDER
============================================================ */

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({
  children,
}) => {
  const [user, setUser] =
    useState<User | null>(null);

  const [workspace, setWorkspace] =
    useState<Workspace | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  /* ==========================================================
     HIDRATAR SESSÃO
  ========================================================== */

  const hydrateSession =
    useCallback(async (): Promise<boolean> => {
      try {
        const currentUser =
          await authService.getCurrentUser();

        /* ----------------------------------------------------
           SEM UTILIZADOR
        ---------------------------------------------------- */

        if (!currentUser) {
          setUser(null);
          setWorkspace(null);

          return false;
        }

        /* ----------------------------------------------------
           UTILIZADOR ENCONTRADO
        ---------------------------------------------------- */

        setUser(currentUser);

        /* ----------------------------------------------------
           BUSCAR WORKSPACE
        ---------------------------------------------------- */

        const currentWorkspace =
          await authService.getCurrentWorkspace();

        if (!currentWorkspace) {
          console.warn(
            '[AuthContext] Nenhum workspace encontrado para o utilizador.'
          );

          setWorkspace(null);

          return false;
        }

        console.log(
          '[AuthContext] Sessão hidratada:',
          {
            userId: currentUser.id,
            workspaceId: currentWorkspace.id,
          }
        );

        setWorkspace(
          currentWorkspace
        );

        return true;

      } catch (error) {
        console.error(
          '[AuthContext] Erro ao hidratar sessão:',
          error
        );

        setUser(null);
        setWorkspace(null);

        return false;
      }
    }, []);

  /* ==========================================================
     INICIALIZAÇÃO
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        try {
          await hydrateSession();
        } catch (error) {
          console.error(
            '[AuthContext] Erro durante inicialização:',
            error
          );

          if (mounted) {
            setUser(null);
            setWorkspace(null);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void initialize();

    /* --------------------------------------------------------
       SUPABASE NÃO CONFIGURADO
    -------------------------------------------------------- */

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    /* --------------------------------------------------------
       OBSERVAR ALTERAÇÕES DE AUTENTICAÇÃO
    -------------------------------------------------------- */

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (event) => {
          if (!mounted) {
            return;
          }

          console.log(
            '[AuthContext] Auth event:',
            event
          );

          /* --------------------------------------------------
             LOGOUT
          -------------------------------------------------- */

          if (
            event === 'SIGNED_OUT'
          ) {
            setUser(null);
            setWorkspace(null);
            setLoading(false);

            return;
          }

          /* --------------------------------------------------
             LOGIN / REFRESH / UPDATE
          -------------------------------------------------- */

          if (
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED'
          ) {
            /*
             * Não executar operações adicionais diretamente
             * dentro do callback do Supabase Auth.
             *
             * O setTimeout evita problemas de concorrência
             * com o ciclo interno de autenticação do Supabase.
             */

            window.setTimeout(
              async () => {
                if (!mounted) {
                  return;
                }

                setLoading(true);

                try {
                  await hydrateSession();
                } catch (error) {
                  console.error(
                    '[AuthContext] Erro ao sincronizar sessão:',
                    error
                  );

                  if (mounted) {
                    setUser(null);
                    setWorkspace(null);
                  }
                } finally {
                  if (mounted) {
                    setLoading(false);
                  }
                }
              },
              0
            );
          }
        }
      );

    /* --------------------------------------------------------
       CLEANUP
    -------------------------------------------------------- */

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, [
    hydrateSession,
  ]);

  /* ==========================================================
     LOGIN
  ========================================================== */

  const login =
    useCallback(
      async (
        email: string,
        pass: string
      ): Promise<void> => {
        const normalizedEmail =
          email.trim();

        if (!normalizedEmail) {
          throw new Error(
            'Informe o seu e-mail.'
          );
        }

        if (!pass) {
          throw new Error(
            'Informe a sua palavra-passe.'
          );
        }

        setLoading(true);

        try {
          const result =
            await authService.login(
              normalizedEmail,
              pass
            );

          if (!result?.user) {
            throw new Error(
              'Não foi possível iniciar a sessão.'
            );
          }

          setUser(
            result.user
          );

          setWorkspace(
            result.workspace ?? null
          );

        } catch (error) {
          console.error(
            '[AuthContext] Erro no login:',
            error
          );

          setUser(null);
          setWorkspace(null);

          throw error;
        } finally {
          setLoading(false);
        }
      },
      []
    );

  /* ==========================================================
     REGISTER
  ========================================================== */

  const register =
    useCallback(
      async (
        name: string,
        company: string,
        email: string,
        pass: string
      ): Promise<{
        emailConfirmationRequired?: boolean;
      }> => {
        const normalizedName =
          name.trim();

        const normalizedCompany =
          company.trim();

        const normalizedEmail =
          email.trim();

        if (!normalizedName) {
          throw new Error(
            'Informe o seu nome.'
          );
        }

        if (!normalizedCompany) {
          throw new Error(
            'Informe o nome da empresa.'
          );
        }

        if (!normalizedEmail) {
          throw new Error(
            'Informe o seu e-mail.'
          );
        }

        if (!pass) {
          throw new Error(
            'Informe uma palavra-passe.'
          );
        }

        setLoading(true);

        try {
          const result =
            (await authService.register(
              normalizedName,
              normalizedCompany,
              normalizedEmail,
              pass
            )) as RegisterResult;

          /* --------------------------------------------------
             CONFIRMAÇÃO DE E-MAIL
          -------------------------------------------------- */

          if (
            result?.emailConfirmationRequired
          ) {
            /*
             * Não definir utilizador/workspace aqui.
             * O utilizador ainda precisa confirmar o e-mail.
             */

            setUser(null);
            setWorkspace(null);

            return {
              emailConfirmationRequired:
                true,
            };
          }

          /* --------------------------------------------------
             REGISTRO NORMAL
          -------------------------------------------------- */

          if (result?.user) {
            setUser(
              result.user
            );
          }

          if (result?.workspace) {
            setWorkspace(
              result.workspace
            );
          }

          /*
           * Alguns fluxos de registro podem criar a conta,
           * mas não devolver imediatamente o workspace.
           *
           * Nesse caso tentamos hidratar a sessão novamente.
           */

          if (
            result?.user &&
            !result?.workspace
          ) {
            await hydrateSession();
          }

          return {
            emailConfirmationRequired:
              false,
          };

        } catch (error) {
          console.error(
            '[AuthContext] Erro no registro:',
            error
          );

          throw error;

        } finally {
          setLoading(false);
        }
      },
      [
        hydrateSession,
      ]
    );

  /* ==========================================================
     GOOGLE
  ========================================================== */

  const loginWithGoogle =
    useCallback(
      async (): Promise<void> => {
        setLoading(true);

        try {
          await authService.loginWithGoogle();

          /*
           * Normalmente o Supabase redireciona o navegador
           * para o Google.
           *
           * Não fazemos logout nem limpamos o estado aqui.
           * O evento SIGNED_IN será responsável por hidratar
           * a sessão quando o utilizador voltar.
           */
        } catch (error) {
          console.error(
            '[AuthContext] Erro no login com Google:',
            error
          );

          setLoading(false);

          throw error;
        }
      },
      []
    );

  /* ==========================================================
     LOGOUT
  ========================================================== */

  const logout =
    useCallback(
      async (): Promise<void> => {
        setLoading(true);

        try {
          await authService.logout();

          /*
           * Limpamos imediatamente o estado local.
           * O evento SIGNED_OUT do Supabase também fará isso,
           * caso esteja configurado.
           */

          setUser(null);
          setWorkspace(null);

        } catch (error) {
          console.error(
            '[AuthContext] Erro ao terminar sessão:',
            error
          );

          /*
           * Mesmo se o backend retornar erro,
           * não deixamos a interface presa no estado
           * de utilizador autenticado se a sessão local
           * já tiver sido removida.
           */

          throw error;

        } finally {
          setLoading(false);
        }
      },
      []
    );

  /* ==========================================================
     UPDATE WORKSPACE
  ========================================================== */

  const updateWorkspace =
    useCallback(
      async (
        data: Partial<Workspace>
      ): Promise<void> => {
        if (!workspace?.id) {
          throw new Error(
            'Workspace não encontrado.'
          );
        }

        if (!data || Object.keys(data).length === 0) {
          return;
        }

        try {
          const updated =
            await authService.updateWorkspace(
              data
            );

          if (!updated) {
            throw new Error(
              'O workspace atualizado não foi retornado.'
            );
          }

          /*
           * Substitui o workspace pelo objeto retornado
           * pelo backend.
           */

          setWorkspace(
            updated
          );

        } catch (error) {
          console.error(
            '[AuthContext] Erro ao atualizar workspace:',
            error
          );

          throw error;
        }
      },
      [
        workspace?.id,
      ]
    );

  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const contextValue: AuthContextType = {
    user,
    workspace,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    updateWorkspace,
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ============================================================
   HOOK
============================================================ */

export const useAuth =
  (): AuthContextType => {
    const context =
      useContext(
        AuthContext
      );

    if (!context) {
      throw new Error(
        'useAuth must be used within an AuthProvider'
      );
    }

    return context;
  };