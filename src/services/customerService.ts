import { Customer } from '../types';
import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

const STORAGE_KEY = 'stalmind_v2_customers';

// ==========================================================
// HELPERS
// ==========================================================

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

function normalizeCustomer(
  customer: any
): Customer {
  return {
    ...customer,

    id: customer?.id,

    workspace_id:
      customer?.workspace_id ?? undefined,

    name:
      customer?.name ?? '',

    company:
      customer?.company ??
      customer?.company_name ??
      '',

    company_name:
      customer?.company_name ??
      customer?.company ??
      '',

    tax_id:
      customer?.tax_id ?? '',

    email:
      customer?.email ?? '',

    phone:
      customer?.phone ?? '',

    mobile:
      customer?.mobile ?? '',

    address:
      customer?.address ?? '',

    city:
      customer?.city ?? '',

    postal_code:
      customer?.postal_code ?? '',

    country:
      customer?.country ?? 'PT',

    notes:
      customer?.notes ?? '',

    is_active:
      customer?.is_active ?? true,

    created_at:
      customer?.created_at,

    updated_at:
      customer?.updated_at,
  } as Customer;
}

// ==========================================================
// RESOLVER WORKSPACE
//
// Aceita workspace vindo:
// 1. do parâmetro explícito
// 2. do próprio cliente
// ==========================================================

function resolveWorkspaceId(
  workspaceId?: string,
  customer?: Partial<Customer> | null
): string | null {

  if (
    typeof workspaceId === 'string' &&
    workspaceId.trim()
  ) {
    return workspaceId.trim();
  }

  const customerWorkspaceId =
    customer?.workspace_id;

  if (
    typeof customerWorkspaceId === 'string' &&
    customerWorkspaceId.trim()
  ) {
    return customerWorkspaceId.trim();
  }

  return null;
}

// ==========================================================
// SERVICE
// ==========================================================

export const customerService = {

  // ========================================================
  // LISTAR CLIENTES
  // ========================================================

  async getCustomers(
    workspaceId?: string
  ): Promise<Customer[]> {

    if (!workspaceId) {
      return getLocalCustomers();
    }

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      return getLocalCustomers()
        .filter(
          customer =>
            !customer.workspace_id ||
            customer.workspace_id === workspaceId
        )
        .map(normalizeCustomer);
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

  // ========================================================
  // BUSCAR CLIENTE
  // ========================================================

  async getCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer | null> {

    if (!customerId) {
      return null;
    }

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
              item.workspace_id === workspaceId
            )
        );

      return customer
        ? normalizeCustomer(customer)
        : null;
    }

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

    return normalizeCustomer(data);
  },

  // ========================================================
  // CRIAR CLIENTE
  // ========================================================

  async createCustomer(
    customer: Partial<Customer>,
    workspaceId?: string,
    userId?: string
  ): Promise<Customer> {

    const resolvedWorkspaceId =
      resolveWorkspaceId(
        workspaceId,
        customer
      );

    if (!resolvedWorkspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    const payload = {
      workspace_id:
        resolvedWorkspaceId,

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

    // ======================================================
    // LOCAL
    // ======================================================

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {
      const localCustomer =
        normalizeCustomer({
          ...payload,

          id:
            crypto.randomUUID(),

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

    // ======================================================
    // SUPABASE
    // ======================================================

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

  // ========================================================
  // ATUALIZAR CLIENTE
  //
  // Compatível com:
  //
  // updateCustomer(id, customer, workspaceId)
  //
  // updateCustomer(id, customer)
  //
  // updateCustomer(id, workspaceId, customer)
  // ========================================================

  async updateCustomer(
    customerId: string,
    arg2?: Partial<Customer> | string,
    arg3?: Partial<Customer> | string
  ): Promise<Customer> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
      );
    }

    // ======================================================
    // NORMALIZAR ARGUMENTOS
    // ======================================================

    let customer: Partial<Customer>;
    let workspaceId: string | undefined;

    // ------------------------------------------------------
    // FORMATO:
    //
    // updateCustomer(id, workspaceId, customer)
    // ------------------------------------------------------

    if (
      typeof arg2 === 'string'
    ) {
      workspaceId = arg2;

      customer =
        (
          arg3 &&
          typeof arg3 === 'object'
        )
          ? arg3
          : {};
    }

    // ------------------------------------------------------
    // FORMATO:
    //
    // updateCustomer(id, customer, workspaceId)
    // ------------------------------------------------------

    else {
      customer =
        arg2 &&
        typeof arg2 === 'object'
          ? arg2
          : {};

      workspaceId =
        typeof arg3 === 'string'
          ? arg3
          : undefined;
    }

    // ======================================================
    // RESOLVER WORKSPACE
    // ======================================================

    const resolvedWorkspaceId =
      resolveWorkspaceId(
        workspaceId,
        customer
      );

    // ======================================================
    // SE AINDA NÃO TIVER WORKSPACE,
    // BUSCAR O CLIENTE PELO ID
    // E DESCOBRIR O WORKSPACE
    // ======================================================

    if (!resolvedWorkspaceId) {

      if (
        isSupabaseConfigured &&
        supabase
      ) {

        const {
          data: existingCustomer,
          error: findError,
        } = await supabase
          .from('customers')
          .select(
            'id, workspace_id'
          )
          .eq(
            'id',
            customerId
          )
          .maybeSingle();

        if (findError) {
          console.error(
            '[customerService] Erro ao localizar workspace do cliente:',
            findError
          );

          throw findError;
        }

        if (
          existingCustomer?.workspace_id
        ) {
          workspaceId =
            existingCustomer.workspace_id;
        }
      }
    }

    const finalWorkspaceId =
      resolveWorkspaceId(
        workspaceId,
        customer
      );

    if (!finalWorkspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
    }

    console.log(
      '[customerService] UPDATE CLIENTE:',
      {
        customerId,
        workspaceId:
          finalWorkspaceId,
        customer,
      }
    );

    // ======================================================
    // MODO LOCAL
    // ======================================================

    if (
      !isSupabaseConfigured ||
      !supabase
    ) {

      const customers =
        getLocalCustomers();

      const index =
        customers.findIndex(
          item =>
            item.id === customerId &&
            (
              !item.workspace_id ||
              item.workspace_id ===
                finalWorkspaceId
            )
        );

      if (index === -1) {
        throw new Error(
          'Cliente não encontrado.'
        );
      }

      const updatedCustomer =
        normalizeCustomer({
          ...customers[index],

          ...customer,

          id:
            customerId,

          workspace_id:
            finalWorkspaceId,

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

    // ======================================================
    // PAYLOAD
    // ======================================================

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

    // ======================================================
    // ATUALIZAR NO SUPABASE
    //
    // ID + WORKSPACE
    // ======================================================

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
        finalWorkspaceId
      )
      .select('*')
      .maybeSingle();

    // ======================================================
    // ERRO SUPABASE
    // ======================================================

    if (error) {
      console.error(
        '[customerService] Erro Supabase ao atualizar cliente:',
        error
      );

      throw error;
    }

    // ======================================================
    // NENHUM REGISTRO ATUALIZADO
    // ======================================================

    if (!data) {

      console.error(
        '[customerService] UPDATE não retornou cliente:',
        {
          customerId,
          workspaceId:
            finalWorkspaceId,
        }
      );

      throw new Error(
        'Cliente não encontrado.'
      );
    }

    return normalizeCustomer(data);
  },

  // ========================================================
  // EXCLUIR CLIENTE
  // ========================================================

  async deleteCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<void> {

    if (!customerId) {
      throw new Error(
        'ID do cliente não informado.'
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
            customer.id !==
              customerId ||
            (
              workspaceId &&
              customer.workspace_id !==
                workspaceId
            )
        );

      saveLocalCustomers(
        filtered
      );

      return;
    }

    // ======================================================
    // Se workspace não foi informado,
    // descobrir pelo cliente
    // ======================================================

    let finalWorkspaceId =
      workspaceId;

    if (!finalWorkspaceId) {

      const {
        data,
        error,
      } = await supabase
        .from('customers')
        .select(
          'workspace_id'
        )
        .eq(
          'id',
          customerId
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      finalWorkspaceId =
        data?.workspace_id;
    }

    if (!finalWorkspaceId) {
      throw new Error(
        'Workspace não encontrado.'
      );
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
        finalWorkspaceId
      );

    if (error) {
      console.error(
        '[customerService] Erro ao excluir cliente:',
        error
      );

      throw error;
    }
  },

  // ========================================================
  // DESATIVAR
  // ========================================================

  async deactivateCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: false,
        workspace_id:
          workspaceId,
      },
      workspaceId
    );
  },

  // ========================================================
  // REATIVAR
  // ========================================================

  async activateCustomer(
    customerId: string,
    workspaceId?: string
  ): Promise<Customer> {

    return this.updateCustomer(
      customerId,
      {
        is_active: true,
        workspace_id:
          workspaceId,
      },
      workspaceId
    );
  },
};