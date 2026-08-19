import { Customer } from '../types';

import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

const STORAGE_KEY = 'stalmind_v2_customers';

// ============================================================
// HELPERS
// ============================================================

function getLocalCustomers(): Customer[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeCustomer);
  } catch (error) {
    console.error(
      '[customerService] Erro ao ler clientes locais:',
      error
    );

    return [];
  }
}

function saveLocalCustomers(
  customers: Customer[]
): void {
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

function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

// ============================================================
// NORMALIZE
// ============================================================

function normalizeCustomer(
  customer: Partial<Customer> & Record<string, unknown>
): Customer {
  const companyName =
    (customer.company_name as string | null | undefined) ??
    (customer.company as string | null | undefined) ??
    '';

  return {
    id: String(customer.id ?? generateId()),

    workspace_id: String(
      customer.workspace_id ??
        customer.workspaceId ??
        ''
    ),

    type:
      customer.type === 'company'
        ? 'company'
        : 'individual',

    name:
      String(customer.name ?? ''),

    company_name:
      companyName,

    company:
      companyName,

    email:
      String(customer.email ?? ''),

    phone:
      String(customer.phone ?? ''),

    mobile:
      String(customer.mobile ?? ''),

    tax_id:
      String(
        customer.tax_id ??
          customer.taxId ??
          ''
      ),

    taxId:
      String(
        customer.tax_id ??
          customer.taxId ??
          ''
      ),

    address:
      String(customer.address ?? ''),

    city:
      String(customer.city ?? ''),

    postal_code:
      String(customer.postal_code ?? ''),

    country:
      String(customer.country ?? 'PT'),

    notes:
      String(customer.notes ?? ''),

    is_active:
      customer.is_active !== false,

    status:
      customer.status as Customer['status'],

    created_by:
      customer.created_by
        ? String(customer.created_by)
        : null,

    created_at:
      String(
        customer.created_at ??
          new Date().toISOString()
      ),

    updated_at:
      customer.updated_at
        ? String(customer.updated_at)
        : null,

    workspaceId:
      String(
        customer.workspace_id ??
          customer.workspaceId ??
          ''
      ),
  };
}

// ============================================================
// SERVICE
// ============================================================

export const customerService = {

  // ==========================================================
  // GET ALL
  // ==========================================================

  async getCustomers(
    workspaceId?: string
  ): Promise<Customer[]> {

    // LOCAL
    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      if (!workspaceId) {
        return customers;
      }

      return customers.filter(
        customer =>
          customer.workspace_id ===
          workspaceId
      );
    }

    // SUPABASE
    if (!workspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
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

    return (data ?? []).map(
      item =>
        normalizeCustomer(
          item as Record<string, unknown>
        )
    );
  },

  // ==========================================================
  // GET ONE
  // ==========================================================

  async getCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer | null> {

    if (!customerId) {
      return null;
    }

    // LOCAL
    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      const customer =
        customers.find(
          item =>
            item.id === customerId &&
            (
              !workspaceId ||
              item.workspace_id ===
                workspaceId
            )
        );

      return customer ?? null;
    }

    // SUPABASE
    let query =
      supabase
        .from('customers')
        .select('*')
        .eq(
          'id',
          customerId
        );

    if (workspaceId) {
      query = query.eq(
        'workspace_id',
        workspaceId
      );
    }

    const {
      data,
      error,
    } = await query.maybeSingle();

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

    return normalizeCustomer(
      data as Record<string, unknown>
    );
  },

  // ==========================================================
  // CREATE
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

    const now =
      new Date().toISOString();

    const companyName =
      customer.company_name ??
      customer.company ??
      '';

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
        companyName || null,

      tax_id:
        customer.tax_id ??
        customer.taxId ??
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

      status:
        customer.status ??
        'active',

      created_by:
        userId ??
        customer.created_by ??
        null,

      created_at:
        customer.created_at ??
        now,

      updated_at:
        now,
    };

    // LOCAL
    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const localCustomer =
        normalizeCustomer({
          ...payload,
          id: generateId(),
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

    // SUPABASE
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

    return normalizeCustomer(
      data as Record<string, unknown>
    );
  },

  // ==========================================================
  // ADD CUSTOMER
  //
  // Compatibilidade com páginas antigas.
  // ==========================================================

  async addCustomer(
    customer: Partial<Customer>,
    workspaceId?: string,
    userId?: string
  ): Promise<Customer> {

    const resolvedWorkspaceId =
      workspaceId ??
      customer.workspace_id ??
      customer.workspaceId;

    if (!resolvedWorkspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    return this.createCustomer(
      customer,
      resolvedWorkspaceId,
      userId
    );
  },

  // ==========================================================
  // UPDATE
  // ==========================================================

  async updateCustomer(
    customerId: string,
    customer: Partial<Customer>,
    workspaceId?: string
  ): Promise<Customer> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
      );
    }

    // LOCAL
    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      const index =
        customers.findIndex(
          item =>
            item.id ===
            customerId &&
            (
              !workspaceId ||
              item.workspace_id ===
                workspaceId
            )
        );

      if (index === -1) {
        throw new Error(
          'Cliente não encontrado.'
        );
      }

      const updated =
        normalizeCustomer({
          ...customers[index],
          ...customer,
          id: customerId,
          workspace_id:
            workspaceId ??
            customers[index]
              .workspace_id,
          updated_at:
            new Date().toISOString(),
        });

      customers[index] =
        updated;

      saveLocalCustomers(
        customers
      );

      return updated;
    }

    // BUSCAR CLIENTE
    const {
      data: existingCustomer,
      error: findError,
    } = await supabase
      .from('customers')
      .select('*')
      .eq(
        'id',
        customerId
      )
      .maybeSingle();

    if (findError) {
      console.error(
        '[customerService] Erro ao localizar cliente:',
        findError
      );

      throw findError;
    }

    if (!existingCustomer) {
      throw new Error(
        'Cliente não encontrado.'
      );
    }

    const existing =
      existingCustomer as Record<
        string,
        unknown
      >;

    const existingWorkspaceId =
      typeof existing.workspace_id ===
      'string'
        ? existing.workspace_id
        : '';

    const effectiveWorkspaceId =
      existingWorkspaceId ||
      workspaceId;

    if (!effectiveWorkspaceId) {
      throw new Error(
        'Workspace do cliente não encontrado.'
      );
    }

    if (
      workspaceId &&
      existingWorkspaceId &&
      workspaceId !==
        existingWorkspaceId
    ) {
      throw new Error(
        'O cliente não pertence ao workspace informado.'
      );
    }

    const payload: Record<
      string,
      unknown
    > = {};

    if (
      customer.name !==
      undefined
    ) {
      payload.name =
        customer.name;
    }

    if (
      customer.type !==
      undefined
    ) {
      payload.type =
        customer.type;
    }

    if (
      customer.company !==
        undefined ||
      customer.company_name !==
        undefined
    ) {
      payload.company_name =
        customer.company_name ??
        customer.company ??
        null;
    }

    if (
      customer.tax_id !==
        undefined ||
      customer.taxId !==
        undefined
    ) {
      payload.tax_id =
        customer.tax_id ??
        customer.taxId ??
        null;
    }

    if (
      customer.email !==
      undefined
    ) {
      payload.email =
        customer.email ??
        null;
    }

    if (
      customer.phone !==
      undefined
    ) {
      payload.phone =
        customer.phone ??
        null;
    }

    if (
      customer.mobile !==
      undefined
    ) {
      payload.mobile =
        customer.mobile ??
        null;
    }

    if (
      customer.address !==
      undefined
    ) {
      payload.address =
        customer.address ??
        null;
    }

    if (
      customer.city !==
      undefined
    ) {
      payload.city =
        customer.city ??
        null;
    }

    if (
      customer.postal_code !==
      undefined
    ) {
      payload.postal_code =
        customer.postal_code ??
        null;
    }

    if (
      customer.country !==
      undefined
    ) {
      payload.country =
        customer.country ??
        'PT';
    }

    if (
      customer.notes !==
      undefined
    ) {
      payload.notes =
        customer.notes ??
        null;
    }

    if (
      customer.is_active !==
      undefined
    ) {
      payload.is_active =
        customer.is_active;
    }

    if (
      customer.status !==
      undefined
    ) {
      payload.status =
        customer.status;
    }

    payload.updated_at =
      new Date().toISOString();

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
        effectiveWorkspaceId
      )
      .select('*')
      .maybeSingle();

    if (error) {
      console.error(
        '[customerService] Erro ao atualizar cliente:',
        error
      );

      throw error;
    }

    if (!data) {
      throw new Error(
        'Cliente não encontrado para atualização.'
      );
    }

    return normalizeCustomer(
      data as Record<string, unknown>
    );
  },

  // ==========================================================
  // DELETE
  // ==========================================================

  async deleteCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<void> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
      );
    }

    // LOCAL
    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const customers =
        getLocalCustomers();

      const filtered =
        customers.filter(
          customer =>
            !(
              customer.id ===
                customerId &&
              (
                !workspaceId ||
                customer.workspace_id ===
                  workspaceId
              )
            )
        );

      saveLocalCustomers(
        filtered
      );

      return;
    }

    // SUPABASE
    let query =
      supabase
        .from('customers')
        .delete()
        .eq(
          'id',
          customerId
        );

    if (workspaceId) {
      query = query.eq(
        'workspace_id',
        workspaceId
      );
    }

    const {
      error,
    } = await query;

    if (error) {
      console.error(
        '[customerService] Erro ao excluir cliente:',
        error
      );

      throw error;
    }
  },

  // ==========================================================
  // DEACTIVATE
  // ==========================================================

  async deactivateCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: false,
        status: 'inactive',
      },
      workspaceId
    );
  },

  // ==========================================================
  // ACTIVATE
  // ==========================================================

  async activateCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: true,
        status: 'active',
      },
      workspaceId
    );
  },
};