import { Customer } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'stalmind_v2_customers';

function getLocalCustomers(): Customer[] {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error(
        'Erro ao ler clientes locais:',
        error
      );
    }
  }

  return [];
}

function saveLocalCustomers(list: Customer[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(list)
  );
}

export const customerService = {

  async getCustomers(
    workspaceId: string
  ): Promise<Customer[]> {

    if (!workspaceId) {
      console.warn(
        'getCustomers chamado sem workspaceId'
      );

      return [];
    }


    if (isSupabaseConfigured && supabase) {

      const {
        data,
        error
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
            ascending: false
          }
        );


      if (error) {

        console.error(
          'Erro ao carregar clientes do Supabase:',
          error
        );

        throw error;
      }


      if (data) {

        return data.map((item) => ({

          id: item.id,

          workspaceId:
            item.workspace_id,

          name:
            item.name || '',

          email:
            item.email || '',

          phone:
            item.phone || '',

          company:
            item.company ||
            item.company_name ||
            '',

          taxId:
            item.tax_id || '',

          address:
            item.address || '',

          notes:
            item.notes || '',

          status:
            item.is_active
              ? 'active'
              : 'inactive',

          createdAt:
            item.created_at

        }));
      }
    }


    /**
     * Fallback local somente se Supabase
     * não estiver configurado.
     */
    return getLocalCustomers()
      .filter(
        (customer) =>
          customer.workspaceId === workspaceId
      );
  },


  async addCustomer(
    customerData: Omit<
      Customer,
      'id' | 'createdAt'
    >
  ): Promise<Customer> {

    if (!customerData.workspaceId) {
      throw new Error(
        'Workspace não informado.'
      );
    }


    const isActive =
      customerData.status !== 'inactive';


    /**
     * Cria no Supabase primeiro.
     */
    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        data,
        error
      } = await supabase

        .from('customers')

        .insert({

          workspace_id:
            customerData.workspaceId,

          name:
            customerData.name,

          email:
            customerData.email || null,

          phone:
            customerData.phone || null,

          company:
            customerData.company || null,

          tax_id:
            customerData.taxId || null,

          address:
            customerData.address || null,

          notes:
            customerData.notes || null,

          is_active:
            isActive,

          type:
            customerData.company
              ? 'business'
              : 'individual'

        })

        .select()

        .single();


      if (error) {

        console.error(
          'Erro ao criar cliente no Supabase:',
          error
        );

        throw error;
      }


      if (data) {

        const newCustomer: Customer = {

          id: data.id,

          workspaceId:
            data.workspace_id,

          name:
            data.name,

          email:
            data.email || '',

          phone:
            data.phone || '',

          company:
            data.company ||
            data.company_name ||
            '',

          taxId:
            data.tax_id || '',

          address:
            data.address || '',

          notes:
            data.notes || '',

          status:
            data.is_active
              ? 'active'
              : 'inactive',

          createdAt:
            data.created_at

        };


        /**
         * Atualiza cache local.
         */
        const list =
          getLocalCustomers();

        list.unshift(
          newCustomer
        );

        saveLocalCustomers(list);


        return newCustomer;
      }
    }


    /**
     * Fallback local.
     */
    const newCustomer: Customer = {

      ...customerData,

      id:
        crypto.randomUUID(),

      createdAt:
        new Date().toISOString()
    };


    const list =
      getLocalCustomers();

    list.unshift(
      newCustomer
    );

    saveLocalCustomers(list);


    return newCustomer;
  },


  async updateCustomer(
    id: string,
    customerData: Partial<Customer>
  ): Promise<Customer> {

    const list =
      getLocalCustomers();

    const index =
      list.findIndex(
        (customer) =>
          customer.id === id
      );


    if (index === -1) {
      throw new Error(
        'Cliente não encontrado'
      );
    }


    const updated = {

      ...list[index],

      ...customerData

    };


    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const updateData: Record<
        string,
        any
      > = {};


      if (
        customerData.name !== undefined
      ) {
        updateData.name =
          customerData.name;
      }


      if (
        customerData.email !== undefined
      ) {
        updateData.email =
          customerData.email ||
          null;
      }


      if (
        customerData.phone !== undefined
      ) {
        updateData.phone =
          customerData.phone ||
          null;
      }


      if (
        customerData.company !== undefined
      ) {
        updateData.company =
          customerData.company ||
          null;
      }


      if (
        customerData.taxId !== undefined
      ) {
        updateData.tax_id =
          customerData.taxId ||
          null;
      }


      if (
        customerData.address !== undefined
      ) {
        updateData.address =
          customerData.address ||
          null;
      }


      if (
        customerData.notes !== undefined
      ) {
        updateData.notes =
          customerData.notes ||
          null;
      }


      if (
        customerData.status !== undefined
      ) {
        updateData.is_active =
          customerData.status !==
          'inactive';
      }


      updateData.updated_at =
        new Date().toISOString();


      const {
        error
      } = await supabase

        .from('customers')

        .update(updateData)

        .eq(
          'id',
          id
        );


      if (error) {

        console.error(
          'Erro ao atualizar cliente:',
          error
        );

        throw error;
      }
    }


    list[index] =
      updated;

    saveLocalCustomers(
      list
    );


    return updated;
  },


  async deleteCustomer(
    id: string
  ): Promise<void> {

    if (
      isSupabaseConfigured &&
      supabase
    ) {

      const {
        error
      } = await supabase

        .from('customers')

        .delete()

        .eq(
          'id',
          id
        );


      if (error) {

        console.error(
          'Erro ao excluir cliente:',
          error
        );

        throw error;
      }
    }


    const list =
      getLocalCustomers()
        .filter(
          (customer) =>
            customer.id !== id
        );


    saveLocalCustomers(
      list
    );
  }
};