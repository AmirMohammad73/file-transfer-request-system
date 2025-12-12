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
    
    // منتظر فعال شدن Service Worker بمان
    await navigator.serviceWorker.ready;
    
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
    console.warn('کارکن مجوز اعلان را رد کرده است');
    return 'denied';
  }

  // درخواست permission
  try {
    const permission = await Notification.requestPermission();
    console.log('نتیجه درخواست مجوز:', permission);
    return permission;
  } catch (error) {
    console.error('خطا در درخواست مجوز:', error);
    return 'denied';
  }
};

// نمایش Notification از طریق Service Worker
export const showNotification = async (options: {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  requireInteraction?: boolean;
  silent?: boolean;
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

  // ابتدا سعی می‌کنیم از Service Worker استفاده کنیم
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    try {
      // ارسال پیام به Service Worker
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: options.title,
        body: options.body,
        tag: options.tag,
        icon: options.icon,
        requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : true, // پیش‌فرض true
        silent: options.silent !== undefined ? options.silent : false,
      });
      
      console.log('پیام به Service Worker ارسال شد');
      return;
    } catch (error) {
      console.error('خطا در ارسال پیام به Service Worker:', error);
    }
  }

  // Fallback 1: استفاده مستقیم از Service Worker registration
  if (serviceWorkerRegistration && 'showNotification' in serviceWorkerRegistration) {
    try {
      await serviceWorkerRegistration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.icon || '/favicon.ico',
        tag: options.tag,
        dir: 'rtl',
        lang: 'fa',
        requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : true, // مهم
        silent: options.silent !== undefined ? options.silent : false,
      });
      return;
    } catch (error) {
      console.error('خطا در نمایش Notification از طریق Service Worker:', error);
    }
  }

  // Fallback 2: استفاده از Notification API مستقیم
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.icon || '/favicon.ico',
        tag: options.tag,
        dir: 'rtl',
        lang: 'fa',
        requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : true, // اینجا هم اضافه شده
        silent: options.silent !== undefined ? options.silent : false,
      });

      console.log('اعلان مستقیم نمایش داده شد');

      // حذف timeout بستن خودکار
      // دیگر notification را به صورت خودکار نمی‌بندیم

      // کلیک روی Notification
      notification.onclick = () => {
        console.log('اعلان کلیک شد');
        window.focus();
        notification.close();
      };

      // رویداد بسته شدن
      notification.onclose = () => {
        console.log('اعلان بسته شد');
      };

      // مدیریت خطا
      notification.onerror = (error) => {
        console.error('خطا در نمایش اعلان:', error);
      };
      
      return;
    } catch (error) {
      console.error('خطا در نمایش اعلان مستقیم:', error);
    }
  }
};

// دریافت Service Worker registration
export const getServiceWorkerRegistration = (): ServiceWorkerRegistration | null => {
  return serviceWorkerRegistration;
};

// تابع کمکی برای اعلان‌های مهم (همیشه باقی می‌مانند)
export const showPersistentNotification = async (title: string, body: string, options?: {
  icon?: string;
  tag?: string;
}): Promise<void> => {
  await showNotification({
    title,
    body,
    icon: options?.icon,
    tag: options?.tag || `persistent-${Date.now()}`,
    requireInteraction: true, // حتماً true
    silent: false,
  });
};

// تابع برای تست Service Worker
export const testServiceWorker = async (): Promise<boolean> => {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    console.warn('Service Worker فعال نیست');
    return false;
  }
  
  try {
    // ارسال پیام تست
    navigator.serviceWorker.controller.postMessage({
      type: 'TEST',
      timestamp: Date.now()
    });
    
    console.log('پیام تست به Service Worker ارسال شد');
    return true;
  } catch (error) {
    console.error('خطا در ارسال پیام تست:', error);
    return false;
  }
};