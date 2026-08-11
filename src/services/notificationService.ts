import { AppNotification } from '../types';

const INITIAL_NOTIFICATIONS: AppNotification[] = [];

const STORAGE_KEY = 'stalmind_v2_app_notifications';

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
