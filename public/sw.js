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
    const { title, body, tag, icon } = event.data;
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: icon || '/favicon.ico',
        badge: icon || '/favicon.ico',
        tag: tag,
        dir: 'rtl', // راست به چپ برای فارسی
        lang: 'fa',
        requireInteraction: false, // بستن خودکار
        silent: false, // پخش صدا
      })
    );
  }
});

// کلیک روی Notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // اگر یک پنجره باز است، آن را focus کن
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // اگر پنجره‌ای باز نیست، یک پنجره جدید باز کن
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

