'use client';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "onstream-6a46b.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "onstream-6a46b",
  storageBucket: "onstream-6a46b.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "635674662728",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:635674662728:web:603b0f17a1e43fd096457d",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
const storage = getStorage(firebaseApp);

export default storage;