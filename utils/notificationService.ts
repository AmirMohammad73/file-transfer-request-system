// سرویس برای مدیریت Notification با Service Worker

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

// ثبت Service Worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('این مرورگر از Service Worker پشتیبانی نمی‌کند');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    serviceWorkerRegistration = registration;
    console.log('Service Worker ثبت شد:', registration.scope);
    
    return registration;
  } catch (error) {
    console.error('خطا در ثبت Service Worker:', error);
    return null;
  }
};

// درخواست permission برای Notification
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('این مرورگر از Notification API پشتیبانی نمی‌کند');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // درخواست permission
  const permission = await Notification.requestPermission();
  return permission;
};

// نمایش Notification از طریق Service Worker
export const showNotification = async (options: {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
}): Promise<void> => {
  if (!('Notification' in window)) {
    console.warn('این مرورگر از Notification API پشتیبانی نمی‌کند');
    return;
  }

  // بررسی permission
  if (Notification.permission !== 'granted') {
    console.warn('مجوز ارسال Notification داده نشده است');
    return;
  }

  // اگر Service Worker فعال است، از آن استفاده کن
  if (serviceWorkerRegistration && 'showNotification' in serviceWorkerRegistration) {
    try {
      await serviceWorkerRegistration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.icon || '/favicon.ico',
        tag: options.tag,
        dir: 'rtl',
        lang: 'fa',
        requireInteraction: false,
      });
      return;
    } catch (error) {
      console.error('خطا در نمایش Notification از طریق Service Worker:', error);
    }
  }

  // Fallback: استفاده از Notification API مستقیم
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      badge: options.icon || '/favicon.ico',
      tag: options.tag,
      dir: 'rtl',
      lang: 'fa',
    });

    // بستن خودکار بعد از 5 ثانیه
    setTimeout(() => {
      notification.close();
    }, 5000);

    // کلیک روی Notification
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

// دریافت Service Worker registration
export const getServiceWorkerRegistration = (): ServiceWorkerRegistration | null => {
  return serviceWorkerRegistration;
};

