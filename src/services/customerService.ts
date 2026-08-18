import { Customer } from '../types';
import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

const STORAGE_KEY = 'stalmind_v2_customers';

function getLocalCustomers(): Customer[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(
      '[customerService] Erro ao ler clientes locais:',
      error
    );

    return [];
  }
}

function saveLocalCustomers(customers: Customer[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(customers)
    );
  } catch (error) {
    console.error(
      '[customerService] Erro ao salvar clientes locais:',
      error
    );
  }
}

function normalizeCustomer(
  customer: any
): Customer {
  return {
    ...customer,

    id: customer.id,

    workspace_id:
      customer.workspace_id ?? undefined,

    name:
      customer.name ?? '',

    company:
      customer.company ??
      customer.company_name ??
      '',

    company_name:
      customer.company_name ??
      customer.company ??
      '',

    tax_id:
      customer.tax_id ?? '',

    email:
      customer.email ?? '',

    phone:
      customer.phone ?? '',

    mobile:
      customer.mobile ?? '',

    address:
      customer.address ?? '',

    city:
      customer.city ?? '',

    postal_code:
      customer.postal_code ?? '',

    country:
      customer.country ?? 'PT',

    notes:
      customer.notes ?? '',

    is_active:
      customer.is_active ?? true,

    created_at:
      customer.created_at,

    updated_at:
      customer.updated_at,
  } as Customer;
}

export const customerService = {

  // ==========================================================
  // LISTAR CLIENTES
  // ==========================================================

  async getCustomers(
    workspaceId?: string
  ): Promise<Customer[]> {

    if (
      !isSupabaseConfigured ||
      !supabase ||
      !workspaceId
    ) {
      return getLocalCustomers();
    }

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .select('*')
      .eq(
        'workspace_id',
        workspaceId
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

    if (error) {
      console.error(
        '[customerService] Erro ao carregar clientes:',
        error
      );

      throw error;
    }

    return (
      data ?? []
    ).map(normalizeCustomer);
  },

  // ==========================================================
  // BUSCAR CLIENTE
  // ==========================================================

  async getCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer | null> {

    if (!customerId) {
      return null;
    }

    if (
      !isSupabaseConfigured ||
      !supabase ||
      !workspaceId
    ) {
      const customers =
        getLocalCustomers();

      return (
        customers.find(
          customer =>
            customer.id === customerId
        ) ?? null
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .select('*')
      .eq(
        'id',
        customerId
      )
      .eq(
        'workspace_id',
        workspaceId
      )
      .maybeSingle();

    if (error) {
      console.error(
        '[customerService] Erro ao buscar cliente:',
        error
      );

      throw error;
    }

    if (!data) {
      return null;
    }

    return normalizeCustomer(data);
  },

  // ==========================================================
  // CRIAR CLIENTE
  // ==========================================================

  async createCustomer(
    customer: Partial<Customer>,
    workspaceId: string,
    userId?: string
  ): Promise<Customer> {

    if (!workspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    const payload = {
      workspace_id:
        workspaceId,

      type:
        customer.type ??
        'individual',

      name:
        customer.name ??
        '',

      company_name:
        customer.company_name ??
        customer.company ??
        null,

      tax_id:
        customer.tax_id ??
        null,

      email:
        customer.email ??
        null,

      phone:
        customer.phone ??
        null,

      mobile:
        customer.mobile ??
        null,

      address:
        customer.address ??
        null,

      city:
        customer.city ??
        null,

      postal_code:
        customer.postal_code ??
        null,

      country:
        customer.country ??
        'PT',

      notes:
        customer.notes ??
        null,

      is_active:
        customer.is_active ??
        true,

      created_by:
        userId ??
        null,
    };

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const localCustomer =
        normalizeCustomer({
          ...payload,
          id: crypto.randomUUID(),
          created_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        });

      const customers =
        getLocalCustomers();

      customers.unshift(
        localCustomer
      );

      saveLocalCustomers(
        customers
      );

      return localCustomer;
    }

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error(
        '[customerService] Erro ao criar cliente:',
        error
      );

      throw error;
    }

    return normalizeCustomer(data);
  },

  // ==========================================================
  // ATUALIZAR CLIENTE
  // ==========================================================

  async updateCustomer(
    customerId: string,
    customer: Partial<Customer>,
    workspaceId: string
  ): Promise<Customer> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
      );
    }

    if (!workspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    // --------------------------------------------------------
    // MODO LOCAL
    // --------------------------------------------------------

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      const index =
        customers.findIndex(
          item =>
            item.id === customerId
        );

      if (index === -1) {
        throw new Error(
          'Cliente não encontrado'
        );
      }

      const updatedCustomer =
        normalizeCustomer({
          ...customers[index],
          ...customer,
          id: customerId,
          workspace_id:
            workspaceId,
          updated_at:
            new Date().toISOString(),
        });

      customers[index] =
        updatedCustomer;

      saveLocalCustomers(
        customers
      );

      return updatedCustomer;
    }

    // --------------------------------------------------------
    // PAYLOAD
    // --------------------------------------------------------

    const payload: Record<
      string,
      any
    > = {};

    if (
      customer.name !== undefined
    ) {
      payload.name =
        customer.name;
    }

    if (
      customer.type !== undefined
    ) {
      payload.type =
        customer.type;
    }

    if (
      customer.company !== undefined ||
      customer.company_name !== undefined
    ) {
      payload.company_name =
        customer.company_name ??
        customer.company ??
        null;
    }

    if (
      customer.tax_id !== undefined
    ) {
      payload.tax_id =
        customer.tax_id ??
        null;
    }

    if (
      customer.email !== undefined
    ) {
      payload.email =
        customer.email ??
        null;
    }

    if (
      customer.phone !== undefined
    ) {
      payload.phone =
        customer.phone ??
        null;
    }

    if (
      customer.mobile !== undefined
    ) {
      payload.mobile =
        customer.mobile ??
        null;
    }

    if (
      customer.address !== undefined
    ) {
      payload.address =
        customer.address ??
        null;
    }

    if (
      customer.city !== undefined
    ) {
      payload.city =
        customer.city ??
        null;
    }

    if (
      customer.postal_code !== undefined
    ) {
      payload.postal_code =
        customer.postal_code ??
        null;
    }

    if (
      customer.country !== undefined
    ) {
      payload.country =
        customer.country ??
        'PT';
    }

    if (
      customer.notes !== undefined
    ) {
      payload.notes =
        customer.notes ??
        null;
    }

    if (
      customer.is_active !== undefined
    ) {
      payload.is_active =
        customer.is_active;
    }

    payload.updated_at =
      new Date().toISOString();

    // --------------------------------------------------------
    // ATUALIZAÇÃO
    //
    // MUITO IMPORTANTE:
    // id + workspace_id
    // --------------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from('customers')
      .update(payload)
      .eq(
        'id',
        customerId
      )
      .eq(
        'workspace_id',
        workspaceId
      )
      .select('*')
      .maybeSingle();

    if (error) {
      console.error(
        '[customerService] Erro Supabase ao atualizar cliente:',
        error
      );

      throw error;
    }

    // --------------------------------------------------------
    // NENHUMA LINHA ATUALIZADA
    // --------------------------------------------------------

    if (!data) {
      console.error(
        '[customerService] Cliente não encontrado para atualização:',
        {
          customerId,
          workspaceId,
        }
      );

      throw new Error(
        'Cliente não encontrado'
      );
    }

    return normalizeCustomer(data);
  },

  // ==========================================================
  // EXCLUIR CLIENTE
  // ==========================================================

  async deleteCustomer(
    customerId: string,
    workspaceId: string
  ): Promise<void> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
      );
    }

    if (!workspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      const filtered =
        customers.filter(
          customer =>
            customer.id !== customerId
        );

      saveLocalCustomers(
        filtered
      );

      return;
    }

    const {
      error,
    } = await supabase
      .from('customers')
      .delete()
      .eq(
        'id',
        customerId
      )
      .eq(
        'workspace_id',
        workspaceId
      );

    if (error) {
      console.error(
        '[customerService] Erro ao excluir cliente:',
        error
      );

      throw error;
    }
  },

  // ==========================================================
  // ALTERNATIVA: DESATIVAR CLIENTE
  // ==========================================================

  async deactivateCustomer(
    customerId: string,
    workspaceId: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: false,
      },
      workspaceId
    );
  },

  // ==========================================================
  // ALTERNATIVA: REATIVAR CLIENTE
  // ==========================================================

  async activateCustomer(
    customerId: string,
    workspaceId: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: true,
      },
      workspaceId
    );
  },
};