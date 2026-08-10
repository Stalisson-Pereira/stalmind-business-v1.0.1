import { AppNotification } from '../types';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_1',
    title: 'Orçamento Aceite!',
    message: 'O cliente Nexus Tech Lda aceitou o orçamento #ORC-2026-004 (€650,00).',
    type: 'quote',
    read: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    link: '/quotes',
  },
  {
    id: 'notif_2',
    title: 'Pagamento Recebido (MB WAY)',
    message: 'Recebeu €150,00 de Ana Martins referente a Sessão de Consultoria.',
    type: 'payment',
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    link: '/financial',
  },
  {
    id: 'notif_3',
    title: 'Nova Mensagem do Cliente',
    message: 'Oliveira & Filhos Studio enviou um novo anexo no chat de projeto.',
    type: 'message',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    link: '/messages',
  },
  {
    id: 'notif_4',
    title: 'Cobrança Automática Enviada',
    message: 'Lembrete enviado com sucesso via WhatsApp para Bloom Arquitetura.',
    type: 'billing',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    link: '/payments',
  },
  {
    id: 'notif_5',
    title: 'Backup do Sistema Concluído',
    message: 'Os seus dados do espaço de trabalho foram salvos com criptografia.',
    type: 'system',
    read: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

const STORAGE_KEY = 'stalmind_app_notifications';

export const notificationService = {
  getNotifications(): AppNotification[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  },

  markAsRead(id: string): AppNotification[] {
    const list = this.getNotifications().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  },

  markAllAsRead(): AppNotification[] {
    const list = this.getNotifications().map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  },

  deleteNotification(id: string): AppNotification[] {
    const list = this.getNotifications().filter((n) => n.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  },

  clearAll(): AppNotification[] {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  },
};
