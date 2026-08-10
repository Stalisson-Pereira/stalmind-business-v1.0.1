import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Workspace } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, company: string, email: string, pass: string) => Promise<{ emailConfirmationRequired?: boolean }>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateWorkspace: (data: Partial<Workspace>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateSession = async () => {
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) {
      setUser(null);
      setWorkspace(null);
      return false;
    }

    const currentWorkspace = await authService.getCurrentWorkspace(currentUser.id);
    if (!currentWorkspace) {
      throw new Error('Utilizador autenticado, mas nenhuma organização foi encontrada para esta conta.');
    }

    setUser(currentUser);
    setWorkspace(currentWorkspace);
    return true;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await hydrateSession();
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
        if (mounted) {
          setUser(null);
          setWorkspace(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setWorkspace(null);
        setLoading(false);
        return;
      }

      // Não fazemos chamadas assíncronas ao Supabase diretamente dentro do
      // callback de onAuthStateChange. O Supabase recomenda agendar o trabalho
      // para depois do callback para evitar deadlocks durante a confirmação do
      // e-mail/OAuth.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(async () => {
          if (!mounted) return;
          try {
            await hydrateSession();
          } catch (error) {
            console.error('Erro ao atualizar sessão:', error);
            if (mounted) {
              setUser(null);
              setWorkspace(null);
            }
          } finally {
            if (mounted) setLoading(false);
          }
        }, 0);
      }
    }).data.subscription;

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await authService.login(email, pass);
      setUser(result.user);
      setWorkspace(result.workspace);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, company: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await authService.register(name, company, email, pass);
      if (result.emailConfirmationRequired) {
        return { emailConfirmationRequired: true };
      }
      setUser(result.user);
      setWorkspace(result.workspace);
      return { emailConfirmationRequired: false };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await authService.loginWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setWorkspace(null);
  };

  const updateWorkspace = async (data: Partial<Workspace>) => {
    const updated = await authService.updateWorkspace(data);
    setWorkspace(updated);
  };

  return (
    <AuthContext.Provider value={{ user, workspace, loading, login, register, loginWithGoogle, logout, updateWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
