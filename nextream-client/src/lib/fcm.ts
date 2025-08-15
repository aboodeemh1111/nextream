import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});

export async function initFcm(accessToken?: string) {
  try {
    if (!(await isSupported())) return null;
    if (!('serviceWorker' in navigator)) return null;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY!;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (token && accessToken) {
      await fetch('/api/notifications/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: `Bearer ${accessToken}` },
        body: JSON.stringify({ token, platform: 'web', userAgent: navigator.userAgent }),
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


