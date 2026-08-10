import { supabase } from '../lib/supabaseClient';
import { User, Workspace } from '../types';

const mapUser = (authUser: any): User => ({
  id: authUser.id,
  email: authUser.email || '',
  name:
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split('@')[0] ||
    'Utilizador Stalmind',
  avatarUrl: authUser.user_metadata?.avatar_url,
  phone: authUser.user_metadata?.phone,
  createdAt: authUser.created_at,
});

const mapWorkspace = (org: any, userId: string): Workspace => ({
  id: org.id,
  name: org.name,
  slug: org.slug || org.id,
  ownerId: userId,
  taxId: org.tax_id || undefined,
  address: org.address || undefined,
  phone: org.phone || undefined,
  email: org.email || undefined,
  currency: org.currency || 'EUR',
  defaultTaxRate: Number(org.default_tax_rate ?? 23),
  createdAt: org.created_at,
});

async function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    const client = await requireSupabase();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return mapUser(data.user);
  },

  async getCurrentWorkspace(userId?: string): Promise<Workspace | null> {
    const client = await requireSupabase();
    const id = userId || (await client.auth.getUser()).data.user?.id;
    if (!id) return null;

    const { data: membership, error: membershipError } = await client
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);
    if (!membership) return null;

    const { data: organization, error: organizationError } = await client
      .from('organizations')
      .select('*')
      .eq('id', membership.organization_id)
      .single();

    if (organizationError) throw new Error(organizationError.message);
    return mapWorkspace(organization, id);
  },

  async login(email: string, password: string): Promise<{ user: User; workspace: Workspace }> {
    const client = await requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Não foi possível iniciar a sessão.');

    const user = mapUser(data.user);
    const workspace = await this.getCurrentWorkspace(data.user.id);
    if (!workspace) {
      throw new Error('A sua conta não está associada a uma organização. Contacte o suporte.');
    }

    return { user, workspace };
  },

  async register(
    name: string,
    company: string,
    email: string,
    password: string,
  ): Promise<{ user: User; workspace: Workspace; emailConfirmationRequired?: boolean }> {
    const client = await requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          company_name: company,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Não foi possível criar a conta.');

    // Quando a confirmação de e-mail está ativa, o Supabase cria o usuário
    // mas não devolve uma sessão até que o e-mail seja confirmado. Isso não é erro.
    if (!data.session) {
      return {
        user: mapUser(data.user),
        workspace: null as unknown as Workspace,
        emailConfirmationRequired: true,
      };
    }

    const user = mapUser(data.user);
    const workspace = await this.getCurrentWorkspace(data.user.id);
    if (!workspace) {
      throw new Error('A conta foi criada, mas a organização não foi criada. Verifique o trigger de onboarding no Supabase.');
    }

    return { user, workspace, emailConfirmationRequired: false };
  },

  async loginWithGoogle(): Promise<void> {
    const client = await requireSupabase();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw new Error(error.message);
  },

  async logout(): Promise<void> {
    const client = await requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async updateWorkspace(data: Partial<Workspace>): Promise<Workspace> {
    const client = await requireSupabase();
    const current = await this.getCurrentWorkspace();
    if (!current) throw new Error('Organização não encontrada.');

    const { data: organization, error } = await client
      .from('organizations')
      .update({
        name: data.name,
        tax_id: data.taxId ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        currency: data.currency,
        default_tax_rate: data.defaultTaxRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapWorkspace(organization, current.ownerId);
  },
};
