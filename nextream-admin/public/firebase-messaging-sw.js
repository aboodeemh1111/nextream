/* global self, importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: self?.env?.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: self?.env?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: self?.env?.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  messagingSenderId: self?.env?.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: self?.env?.NEXT_PUBLIC_FIREBASE_APP_ID || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(({ notification, data }) => {
  const { title, body, image } = notification || {};
  const options = { body, icon: '/vercel.svg', image, data };
  self.registration.showNotification(title || 'Nextream', options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.deepLink || '/';
  event.waitUntil(self.clients.openWindow(url));
});


