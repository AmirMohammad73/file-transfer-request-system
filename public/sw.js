// Service Worker برای نمایش Notification حتی وقتی مرورگر بسته است

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting(); // فعال شدن فوری
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim()); // کنترل فوری تمام صفحات
});

// دریافت پیام از client برای نمایش Notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon, requireInteraction, silent, actions } = event.data;
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon || '/favicon.ico',
        badge: icon || '/favicon.ico',
        tag: tag,
        dir: 'rtl', // راست به چپ برای فارسی
        lang: 'fa',
        requireInteraction: requireInteraction !== undefined ? requireInteraction : true, // تغییر مهم: پیش‌فرض true
        silent: silent !== undefined ? silent : false, // پخش صدا
        vibrate: [200, 100, 200, 100, 200], // ویبره برای تأکید بیشتر
        actions: actions || [], // دکمه‌های action
        data: {
          url: '/',
          timestamp: Date.now(),
          source: 'service-worker'
        }
      })
    );
  }
});

// دریافت Push Notification
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'اعلان جدید',
        body: event.data.text() || 'پیام جدید دریافت شد',
        requireInteraction: true
      };
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'اعلان', {
      body: data.body || 'پیام جدید',
      icon: data.icon || '/favicon.ico',
      badge: data.icon || '/favicon.ico',
      tag: data.tag || 'push-notification',
      dir: 'rtl',
      lang: 'fa',
      requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true, // مهم
      silent: data.silent || false,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/',
        timestamp: Date.now(),
        source: 'push'
      }
    })
  );
});

// کلیک روی Notification
self.addEventListener('notificationclick', (event) => {
  console.log('اعلان کلیک شد:', event.notification.tag);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // اگر یک پنجره باز است، آن را focus کن
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // اگر پنجره‌ای باز نیست، یک پنجره جدید باز کن
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// بستن Notification
self.addEventListener('notificationclose', (event) => {
  console.log('اعلان بسته شد:', event.notification.tag, 'در زمان:', new Date().toISOString());
});