import { Customer } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const INITIAL_CUSTOMERS: Customer[] = [];

const STORAGE_KEY = 'stalmind_v2_customers';

function getLocalCustomers(): Customer[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

function saveLocalCustomers(list: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const customerService = {
  async getCustomers(workspaceId: string): Promise<Customer[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((item) => ({
          id: item.id,
          workspaceId: item.workspace_id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          company: item.company,
          taxId: item.tax_id,
          address: item.address,
          notes: item.notes,
          status: item.status,
          createdAt: item.created_at,
        }));
      }
    }

    return getLocalCustomers().filter((c) => c.workspaceId === workspaceId || !c.workspaceId);
  },

  async addCustomer(customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const newCustomer: Customer = {
      ...customerData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('customers').insert({
        workspace_id: customerData.workspaceId,
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        company: customerData.company,
        tax_id: customerData.taxId,
        address: customerData.address,
        notes: customerData.notes,
        status: customerData.status,
      });
    }

    const list = getLocalCustomers();
    list.unshift(newCustomer);
    saveLocalCustomers(list);
    return newCustomer;
  },

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<Customer> {
    const list = getLocalCustomers();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Cliente não encontrado');

    const updated = { ...list[index], ...customerData };
    list[index] = updated;
    saveLocalCustomers(list);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('customers').update({
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        company: updated.company,
        tax_id: updated.taxId,
        address: updated.address,
        notes: updated.notes,
        status: updated.status,
      }).eq('id', id);
    }

    return updated;
  },

  async deleteCustomer(id: string): Promise<void> {
    const list = getLocalCustomers().filter((c) => c.id !== id);
    saveLocalCustomers(list);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('customers').delete().eq('id', id);
    }
  }
};
