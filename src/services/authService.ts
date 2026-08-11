import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { User, Workspace } from '../types';

const MOCK_USER: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'demo@stalmind.com',
  name: 'Alex Silva',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
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

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          return {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.full_name || 'Usuário Stalmind',
            avatarUrl: data.user.user_metadata?.avatar_url,
            createdAt: data.user.created_at,
          };
        }
      } catch (e) {
        console.warn('Supabase auth.getUser error:', e);
      }
    }

    const savedSession = localStorage.getItem('stalmind_session');
    if (savedSession) {
      try {
        return JSON.parse(savedSession);
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    }
    // Return mock user by default for easy demo testing
    return MOCK_USER;
  },

  async getCurrentWorkspace(): Promise<Workspace> {
    const saved = localStorage.getItem('stalmind_workspace');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return MOCK_WORKSPACE;
  },

  async login(email: string, password: string): Promise<{ user: User; workspace: Workspace }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user: User = {
        id: data.user.id,
        email: data.user.email || email,
        name: data.user.user_metadata?.full_name || email.split('@')[0],
        createdAt: data.user.created_at,
      };
      const workspace = await this.getCurrentWorkspace();
      localStorage.setItem('stalmind_session', JSON.stringify(user));
      return { user, workspace };
    }

    // Mock Login
    const user: User = {
      ...MOCK_USER,
      email: email || MOCK_USER.email,
      name: email ? email.split('@')[0].toUpperCase() : MOCK_USER.name,
    };
    localStorage.setItem('stalmind_session', JSON.stringify(user));
    const workspace = MOCK_WORKSPACE;
    return { user, workspace };
  },

  async register(name: string, company: string, email: string, password: string): Promise<{ user: User; workspace: Workspace }> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, company_name: company },
        },
      });
      if (error) throw new Error(error.message);
      const user: User = {
        id: data.user?.id || crypto.randomUUID(),
        email,
        name,
        createdAt: new Date().toISOString(),
      };
      const workspace: Workspace = {
        ...MOCK_WORKSPACE,
        id: crypto.randomUUID(),
        name: company || `${name} Workspace`,
      };
      localStorage.setItem('stalmind_session', JSON.stringify(user));
      localStorage.setItem('stalmind_workspace', JSON.stringify(workspace));
      return { user, workspace };
    }

    const user: User = {
      id: crypto.randomUUID(),
      email,
      name,
      createdAt: new Date().toISOString(),
    };
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: company || `${name} Workspace`,
      slug: company.toLowerCase().replace(/\s+/g, '-'),
      ownerId: user.id,
      currency: 'EUR',
      defaultTaxRate: 23,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('stalmind_session', JSON.stringify(user));
    localStorage.setItem('stalmind_workspace', JSON.stringify(workspace));
    return { user, workspace };
  },

  async loginWithGoogle(): Promise<void> {
    const googleUser: User = {
      id: 'usr_google_01',
      email: 'usuario.google@stalmind.com',
      name: 'Usuário Google',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      jobTitle: 'Membro da Equipa',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) {
          console.warn('Supabase OAuth Provider não ativo/configurado. Utilizando sessão local Google:', error.message);
          localStorage.setItem('stalmind_session', JSON.stringify(googleUser));
        }
      } catch (err) {
        console.warn('Erro ao conectar com Google OAuth via Supabase, aplicando sessão local:', err);
        localStorage.setItem('stalmind_session', JSON.stringify(googleUser));
      }
    } else {
      localStorage.setItem('stalmind_session', JSON.stringify(googleUser));
    }
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('stalmind_session');
  },

  async updateWorkspace(workspace: Workspace): Promise<Workspace> {
    localStorage.setItem('stalmind_workspace', JSON.stringify(workspace));
    return workspace;
  }
};
