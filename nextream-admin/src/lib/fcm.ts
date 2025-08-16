import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";
import { firebaseApp } from "./firebase";

export async function initFcm(accessToken?: string) {
  try {
    if (!(await isSupported())) return null;
    if (!("serviceWorker" in navigator)) return null;

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    const messaging = getMessaging(firebaseApp);
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token && accessToken) {
      await fetch("/api/notifications/devices/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          token,
          platform: "web",
          userAgent: navigator.userAgent,
        }),
      });

      await fetch("/api/notifications/topics/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, topic: "admins" }),
      });
    }

    onMessage(messaging, (payload) => {
      console.log("FCM foreground:", payload);
    });

    return token;
  } catch (e) {
    console.error("FCM init failed:", e);
    return null;
  }
}
