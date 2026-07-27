'use client';

import { initializeApp, getApps, getApp } from "firebase/app";

// FCM only. Storage now lives on the self-hosted bucket and is reached through
// the API (see lib/uploadClient.ts) — firebase/storage is no longer imported.
// fcm.ts depends on the firebaseApp export, so the app init stays.

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
