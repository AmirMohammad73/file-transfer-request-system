import { useEffect, useState } from 'react';
import { registerServiceWorker, requestNotificationPermission, showNotification as showNotificationService } from '../utils/notificationService';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
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

  useEffect(() => {
    // ثبت Service Worker
    const initServiceWorker = async () => {
      try {
        await registerServiceWorker();
        setIsServiceWorkerReady(true);
      } catch (error) {
        console.error('خطا در ثبت Service Worker:', error);
      }
    };

    initServiceWorker();

    // بررسی permission فعلی
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const showNotification = async (options: NotificationOptions) => {
    await showNotificationService({
      title: options.title,
      body: options.body,
      tag: options.tag,
      icon: options.icon,
    });
  };

  return { 
    showNotification, 
    permission,
    requestPermission,
    isServiceWorkerReady,
  };
};

