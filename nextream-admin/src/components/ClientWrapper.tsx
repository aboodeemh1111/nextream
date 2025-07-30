"use client";

import { AuthProvider } from "@/context/AuthContext";
import { useEffect } from "react";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handle service worker cleanup
    const cleanup = async () => {
      if ("serviceWorker" in navigator) {
        try {
          // Get all registrations
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log("Found service worker registrations:", registrations.length);
          
          // Unregister all service workers
          for (const registration of registrations) {
            console.log("Unregistering service worker:", registration.scope);
            await registration.unregister();
          }
          
          // Clear all caches
          const cacheNames = await caches.keys();
          console.log("Found caches:", cacheNames);
          for (const cacheName of cacheNames) {
            console.log("Deleting cache:", cacheName);
            await caches.delete(cacheName);
          }
          
          // Force reload to ensure clean state
          if (registrations.length > 0) {
            console.log("Service workers removed, reloading page...");
            window.location.reload();
          }
        } catch (error) {
          console.error("Service worker cleanup error:", error);
        }
      }
    };
    
    cleanup();
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}