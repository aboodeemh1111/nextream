import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'onstream-6a46b.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'onstream-6a46b',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '635674662728',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:635674662728:web:603b0f17a1e43fd096457d',
});

export async function initFcm(accessToken?: string) {
  try {
    if (!(await isSupported())) return null;
    if (!('serviceWorker' in navigator)) return null;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (token && accessToken) {
      await fetch('/api/notifications/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: `Bearer ${accessToken}` },
        body: JSON.stringify({ token, platform: 'web', userAgent: navigator.userAgent }),
      });

      await fetch('/api/notifications/topics/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: `Bearer ${accessToken}` },
        body: JSON.stringify({ token, topic: 'admins' }),
      });
    }

    onMessage(messaging, (payload) => {
      console.log('FCM foreground:', payload);
    });

    return token;
  } catch (e) {
    console.error('FCM init failed:', e);
    return null;
  }
}


