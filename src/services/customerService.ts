import { Customer } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não está configurado.');
  }
  return supabase;
}

function mapCustomer(item: any): Customer {
  return {
    id: item.id,
    workspaceId: item.organization_id,
    name: item.name || '',
    email: item.email || '',
    phone: item.phone || item.mobile || '',
    company: item.company_name || '',
    taxId: item.tax_id || '',
    address: item.address || '',
    notes: item.notes || undefined,
    status: item.is_active ? 'active' : 'inactive',
    createdAt: item.created_at,
  };
}

export const customerService = {
  async getCustomers(organizationId: string): Promise<Customer[]> {
    const client = requireSupabase();
    const { data, error } = await client
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Não foi possível carregar os clientes: ${error.message}`);
    return (data || []).map(mapCustomer);
  },

  async addCustomer(customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const client = requireSupabase();
    const { data: authData } = await client.auth.getUser();

    const { data, error } = await client
      .from('customers')
      .insert({
        organization_id: customerData.workspaceId,
        type: customerData.company ? 'business' : 'individual',
        name: customerData.name,
        company_name: customerData.company || null,
        email: customerData.email || null,
        phone: customerData.phone || null,
        tax_id: customerData.taxId || null,
        address: customerData.address || null,
        notes: customerData.notes || null,
        is_active: customerData.status !== 'inactive',
        created_by: authData.user?.id || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Não foi possível criar o cliente: ${error.message}`);
    return mapCustomer(data);
  },

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<Customer> {
    const client = requireSupabase();
    const payload: Record<string, unknown> = {};

    if (customerData.name !== undefined) payload.name = customerData.name;
    if (customerData.company !== undefined) payload.company_name = customerData.company || null;
    if (customerData.email !== undefined) payload.email = customerData.email || null;
    if (customerData.phone !== undefined) payload.phone = customerData.phone || null;
    if (customerData.taxId !== undefined) payload.tax_id = customerData.taxId || null;
    if (customerData.address !== undefined) payload.address = customerData.address || null;
    if (customerData.notes !== undefined) payload.notes = customerData.notes || null;
    if (customerData.status !== undefined) payload.is_active = customerData.status !== 'inactive';
    payload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`Não foi possível atualizar o cliente: ${error.message}`);
    return mapCustomer(data);
  },

  async deleteCustomer(id: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.from('customers').delete().eq('id', id);
    if (error) throw new Error(`Não foi possível eliminar o cliente: ${error.message}`);
  },
};
