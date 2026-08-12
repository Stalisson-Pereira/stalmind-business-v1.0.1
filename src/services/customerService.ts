import { Customer } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'stalmind_v2_customers';

function getLocalCustomers(): Customer[] {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao ler clientes locais:', e);
    }
  }

  return [];
}

function saveLocalCustomers(list: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const customerService = {

  // ============================================================
  // LISTAR CLIENTES
  // ============================================================
  async getCustomers(workspaceId: string): Promise<Customer[]> {

    if (isSupabaseConfigured && supabase) {

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar clientes do Supabase:', error);
      } else if (data) {

        return data.map((item) => ({
          id: item.id,
          workspaceId: item.workspace_id,
          name: item.name,
          email: item.email,
          phone: item.phone,

          // Banco: company_name
          // Frontend: company
          company: item.company_name,

          taxId: item.tax_id,
          address: item.address,
          notes: item.notes,

          // Banco: is_active
          // Frontend: status
          status: item.is_active ? 'active' : 'inactive',

          createdAt: item.created_at,
        }));
      }
    }

    // Fallback local
    return getLocalCustomers().filter(
      (c) =>
        c.workspaceId === workspaceId ||
        !c.workspaceId
    );
  },


  // ============================================================
  // CRIAR CLIENTE
  // ============================================================
  async addCustomer(
    customerData: Omit<Customer, 'id' | 'createdAt'>
  ): Promise<Customer> {

    const newCustomer: Customer = {
      ...customerData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {

      const { data, error } = await supabase
        .from('customers')
        .insert({
          workspace_id: customerData.workspaceId,

          type:
            customerData.status === 'active'
              ? 'business'
              : 'individual',

          name: customerData.name,

          // CORRETO: company_name
          company_name: customerData.company,

          tax_id: customerData.taxId,
          email: customerData.email,
          phone: customerData.phone,
          address: customerData.address,
          notes: customerData.notes,

          // CORRETO: is_active
          is_active: customerData.status !== 'inactive',
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar cliente no Supabase:', error);
        throw error;
      }

      if (data) {
        const savedCustomer: Customer = {
          id: data.id,
          workspaceId: data.workspace_id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company_name,
          taxId: data.tax_id,
          address: data.address,
          notes: data.notes,
          status: data.is_active ? 'active' : 'inactive',
          createdAt: data.created_at,
        };

        return savedCustomer;
      }
    }

    // Fallback local
    const list = getLocalCustomers();

    list.unshift(newCustomer);

    saveLocalCustomers(list);

    return newCustomer;
  },


  // ============================================================
  // ATUALIZAR CLIENTE
  // ============================================================
  async updateCustomer(
    id: string,
    customerData: Partial<Customer>
  ): Promise<Customer> {

    const list = getLocalCustomers();

    const index = list.findIndex(
      (c) => c.id === id
    );

    if (index === -1) {
      throw new Error('Cliente não encontrado');
    }

    const updated = {
      ...list[index],
      ...customerData,
    };

    if (isSupabaseConfigured && supabase) {

      const updateData: Record<string, any> = {};

      if (customerData.name !== undefined) {
        updateData.name = customerData.name;
      }

      if (customerData.email !== undefined) {
        updateData.email = customerData.email;
      }

      if (customerData.phone !== undefined) {
        updateData.phone = customerData.phone;
      }

      if (customerData.company !== undefined) {
        updateData.company_name = customerData.company;
      }

      if (customerData.taxId !== undefined) {
        updateData.tax_id = customerData.taxId;
      }

      if (customerData.address !== undefined) {
        updateData.address = customerData.address;
      }

      if (customerData.notes !== undefined) {
        updateData.notes = customerData.notes;
      }

      if (customerData.status !== undefined) {
        updateData.is_active =
          customerData.status !== 'inactive';
      }

      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error(
          'Erro ao atualizar cliente no Supabase:',
          error
        );

        throw error;
      }
    }

    // Atualiza cache local
    list[index] = updated;

    saveLocalCustomers(list);

    return updated;
  },


  // ============================================================
  // EXCLUIR CLIENTE
  // ============================================================
  async deleteCustomer(id: string): Promise<void> {

    if (isSupabaseConfigured && supabase) {

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(
          'Erro ao excluir cliente do Supabase:',
          error
        );

        throw error;
      }
    }

    // Atualiza cache local
    const list = getLocalCustomers().filter(
      (c) => c.id !== id
    );

    saveLocalCustomers(list);
  },
};