import { useEffect, useState } from 'react';
import { 
  registerServiceWorker, 
  requestNotificationPermission, 
  showNotification as showNotificationService,
  showPersistentNotification,
  testServiceWorker
} from '../utils/notificationService';

interface NotificationOptions {
  title: string;
  body: string;
  requireInteraction?: boolean;
  silent?: boolean;
  icon?: string;
  tag?: string;
}

export const useNotification = () => {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [isServiceWorkerActive, setIsServiceWorkerActive] = useState(false);

  useEffect(() => {
    const initNotifications = async () => {
      // ثبت Service Worker
      try {
        await registerServiceWorker();
        setIsServiceWorkerReady(true);
        
        // بررسی فعال بودن Service Worker
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          setIsServiceWorkerActive(true);
        }
      } catch (error) {
        console.error('خطا در ثبت Service Worker:', error);
      }

      // بررسی permission فعلی
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    initNotifications();
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const showNotification = async (options: NotificationOptions) => {
    // اطمینان از دریافت مجوز
    if (permission !== 'granted') {
      console.warn('لطفاً ابتدا مجوز اعلان را فعال کنید');
      return;
    }
    
    await showNotificationService({
      title: options.title,
      body: options.body,
      tag: options.tag,
      icon: options.icon,
      requireInteraction: options.requireInteraction ?? true, // پیش‌فرض true
      silent: options.silent ?? false,
    });
  };

  const showImportantNotification = async (title: string, body: string, options?: {
    icon?: string;
    tag?: string;
  }) => {
    await showPersistentNotification(title, body, options);
  };

  const testNotifications = async () => {
    const result = await testServiceWorker();
    return result;
  };

  return { 
    showNotification, 
    showImportantNotification,
    testNotifications,
    permission,
    requestPermission,
    isServiceWorkerReady,
    isServiceWorkerActive,
  };
};