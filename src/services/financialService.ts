import {
  FinancialTransaction,
  TransactionStatus,
} from '../types';

const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];

const STORAGE_KEY =
  'stalmind_v2_financial_transactions';

/* ============================================================
   HELPERS
============================================================ */

const getStoredTransactions = (): FinancialTransaction[] => {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
};

const saveTransactions = (
  transactions: FinancialTransaction[],
): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(transactions),
    );
  } catch (error) {
    console.warn(
      '[FinancialService] Não foi possível salvar as transações localmente:',
      error,
    );
  }
};

/* ============================================================
   SERVIÇO FINANCEIRO
============================================================ */

export const financialService = {
  /* ==========================================================
     OBTER TRANSAÇÕES
  ========================================================== */

  async getTransactions(
    workspaceId: string,
  ): Promise<FinancialTransaction[]> {
    if (!workspaceId) {
      return [];
    }

    const transactions =
      getStoredTransactions();

    if (transactions.length === 0) {
      saveTransactions(
        INITIAL_TRANSACTIONS,
      );

      return [];
    }

    return transactions.filter(
      (transaction) =>
        transaction.workspaceId ===
        workspaceId,
    );
  },

  /* ==========================================================
     ADICIONAR TRANSAÇÃO
  ========================================================== */

  async addTransaction(
    tx: Omit<
      FinancialTransaction,
      'id' | 'createdAt'
    >,
  ): Promise<FinancialTransaction> {
    const newTransaction: FinancialTransaction =
      {
        ...tx,
        id: crypto.randomUUID(),
        createdAt:
          new Date().toISOString(),
      };

    const existingTransactions =
      getStoredTransactions();

    const updatedTransactions = [
      newTransaction,
      ...existingTransactions,
    ];

    saveTransactions(
      updatedTransactions,
    );

    return newTransaction;
  },

  /* ==========================================================
     ATUALIZAR STATUS
  ========================================================== */

  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
  ): Promise<void> {
    if (!id) {
      return;
    }

    const transactions =
      getStoredTransactions();

    const updatedTransactions =
      transactions.map(
        (transaction) =>
          transaction.id === id
            ? {
                ...transaction,
                status,
              }
            : transaction,
      );

    saveTransactions(
      updatedTransactions,
    );
  },

  /* ==========================================================
     EXCLUIR TRANSAÇÃO
  ========================================================== */

  async deleteTransaction(
    id: string,
  ): Promise<void> {
    if (!id) {
      return;
    }

    const transactions =
      getStoredTransactions();

    const updatedTransactions =
      transactions.filter(
        (transaction) =>
          transaction.id !== id,
      );

    saveTransactions(
      updatedTransactions,
    );
  },
};