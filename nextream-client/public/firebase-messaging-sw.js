/* global self, importScripts, firebase */
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js"
);

// IMPORTANT: Public web config values for your Firebase project
firebase.initializeApp({
  apiKey: "AIzaSyB91ogaobBfR_bflbdUjr8J_hHBkI7G_JI",
  authDomain: "onstream-6a46b.firebaseapp.com",
  projectId: "onstream-6a46b",
  messagingSenderId: "635674662728",
  appId: "1:635674662728:web:603b0f17a1e43fd096457d",
});

const messaging = firebase.messaging();

// Background messages
messaging.onBackgroundMessage(({ notification, data }) => {
  const { title, body, image } = notification || {};
  const options = { body, icon: "/vercel.svg", image, data };
  self.registration.showNotification(title || "Nextream", options);
});

// Click to open deep link
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.deepLink || "/";
  event.waitUntil(self.clients.openWindow(url));
});
