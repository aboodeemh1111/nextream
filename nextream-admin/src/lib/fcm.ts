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
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;

    // Browser already blocked notifications — getToken would throw messaging/permission-blocked
    if (Notification.permission === "denied") {
      console.warn(
        "Notifications are blocked for this site. Enable them in the browser address bar (lock/info icon) to receive push alerts."
      );
      return null;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return null;
    }

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

      // Only subscribe to topic if backend FCM is configured
      try {
        const hc = await fetch("/api/notifications/health");
        const ok = hc.ok ? await hc.json() : null;
        if (ok?.adminInitialized) {
          await fetch("/api/notifications/topics/subscribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ token, topic: "admins" }),
          });
        } else {
          console.warn("FCM backend not configured; skipping topic subscribe");
        }
      } catch {
        console.warn("FCM health check failed; skipping topic subscribe");
      }
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
