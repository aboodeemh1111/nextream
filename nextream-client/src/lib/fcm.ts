import { initializeApp, getApps } from "firebase/app";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";
import { registerDevice, unregisterDevice } from "@/lib/notifications";

/**
 * Web push registration.
 *
 * The substantive change from the previous version is *when* permission is asked
 * for. That code called `Notification.requestPermission()` from the auth provider
 * on every page load, which is the one pattern every browser vendor explicitly
 * warns against: the prompt appears before the viewer has done anything that
 * would explain it, so it is dismissed, and a dismissal is not a "not now" — it
 * is `denied`, permanently, and there is no API that can ask again. One badly
 * timed prompt costs the account push notifications forever.
 *
 * So there are two entry points, and only one of them can prompt:
 *
 *   `syncPush`   — called on load. Registers the device *only* if permission has
 *                  already been granted. Never prompts. Its job is keeping the
 *                  token current, because FCM rotates them and a stale token is a
 *                  device that silently stops receiving anything.
 *   `enablePush` — called from a button the viewer pressed, on the settings page,
 *                  next to an explanation of what they are agreeing to.
 *
 * Everything returns a reason rather than throwing, because "why is this off"
 * is a question the settings page has to be able to answer precisely — blocked at
 * the browser, unsupported, or simply not set up on the server.
 */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "onstream-6a46b.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "onstream-6a46b",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "635674662728",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:635674662728:web:603b0f17a1e43fd096457d",
};

/** Where the token is remembered, so `disablePush` knows what to revoke. */
const TOKEN_KEY = "nextream:push-token";

export type PushState =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported"
  /** The browser is willing but the server has no VAPID key configured. */
  | "unconfigured";

export interface PushResult {
  ok: boolean;
  state: PushState;
  token?: string;
  /** One sentence the settings page can show verbatim. */
  message?: string;
}

function app() {
  // `getApps()` first: Next's fast refresh re-runs this module, and
  // `initializeApp` twice with the same name throws.
  return getApps().length ? getApps()[0] : initializeApp(CONFIG);
}

let cachedMessaging: Messaging | null = null;

async function messaging(): Promise<Messaging | null> {
  if (cachedMessaging) return cachedMessaging;
  if (!(await isSupported())) return null;
  cachedMessaging = getMessaging(app());
  return cachedMessaging;
}

/** Is push possible in this browser at all? Safari private mode and older Firefox are not. */
export async function pushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  return isSupported().catch(() => false);
}

/** What the browser currently thinks, without asking it for anything. */
export async function pushState(): Promise<PushState> {
  if (!(await pushSupported())) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_KEY) return "unconfigured";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "prompt";
}

export function storedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function remember(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing — the token is still live for this session */
  }
}

/**
 * Registers the service worker.
 *
 * Idempotent: the browser returns the existing registration for the same scope
 * and script, so calling it on every load costs nothing.
 */
async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch {
    return null;
  }
}

/**
 * Mints a token and records it against the account.
 *
 * The API call is what actually matters — a token FCM has issued but the server
 * has never been told about is a device that will never receive anything, and it
 * is the failure mode that looks exactly like "push is broken".
 */
async function claimToken(): Promise<PushResult> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
  if (!vapidKey) {
    return {
      ok: false,
      state: "unconfigured",
      message: "Push isn't set up on this deployment yet.",
    };
  }

  const instance = await messaging();
  const registration = await registerWorker();
  if (!instance || !registration) {
    return { ok: false, state: "unsupported", message: "This browser can't receive push notifications." };
  }

  try {
    const token = await getToken(instance, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) {
      return { ok: false, state: "prompt", message: "The browser didn't issue a push token." };
    }

    await registerDevice(token);
    remember(token);
    return { ok: true, state: "granted", token };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, state: "denied", message };
  }
}

/**
 * Keeps an already-granted registration current. Never prompts.
 *
 * Safe and expected to run on every load: FCM rotates tokens, a viewer may have
 * cleared site data, and the same browser signed into a second account needs the
 * token moved across. All three are silent failures without this.
 */
export async function syncPush(): Promise<PushResult> {
  const state = await pushState();
  if (state !== "granted") return { ok: false, state };
  return claimToken();
}

/**
 * Asks for permission and registers. Must be called from a user gesture.
 *
 * `denied` is terminal, so it is checked before prompting rather than prompting
 * and interpreting the result — the browser resolves `requestPermission()`
 * immediately with `denied` and no dialog appears, which would otherwise read as
 * the button doing nothing.
 */
export async function enablePush(): Promise<PushResult> {
  const state = await pushState();

  if (state === "unsupported") {
    return { ok: false, state, message: "This browser can't receive push notifications." };
  }
  if (state === "unconfigured") {
    return { ok: false, state, message: "Push isn't set up on this deployment yet." };
  }
  if (state === "denied") {
    return {
      ok: false,
      state,
      message:
        "Notifications are blocked for this site. Allow them from the padlock icon in your browser's address bar, then try again.",
    };
  }

  if (state === "prompt") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        state: permission === "denied" ? "denied" : "prompt",
        message: "Notifications weren't allowed.",
      };
    }
  }

  return claimToken();
}

/**
 * Stops this device receiving pushes.
 *
 * Deletes the FCM token *and* removes it server-side. Doing only the second would
 * leave a live token the next `syncPush` re-registers; doing only the first would
 * leave the server sending to a token that no longer resolves, which shows up as
 * a permanently falling delivery rate rather than as a viewer's choice.
 *
 * The browser permission is deliberately left alone: no API can revoke it, and
 * the viewer may want the prompt-free path back later.
 */
export async function disablePush(): Promise<PushResult> {
  const token = storedToken();

  if (token) {
    await unregisterDevice(token).catch(() => {});
  }
  try {
    const instance = await messaging();
    if (instance) await deleteToken(instance);
  } catch {
    /* already gone */
  }
  remember(null);

  return { ok: true, state: await pushState() };
}
