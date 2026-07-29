'use client';

import { AuthProvider } from "@/context/AuthContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SearchProvider } from "@/components/search/SearchProvider";
import ToastStack from "@/components/notifications/ToastStack";

/**
 * Notifications sit inside auth because they are per-viewer: the provider keys its
 * stream and its state on the access token, and mounting it above auth would give
 * it nothing to subscribe to.
 *
 * ToastStack renders here rather than in a page so a notification arriving while
 * the viewer is anywhere in the app has somewhere to appear.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <SearchProvider>{children}</SearchProvider>
        <ToastStack />
      </NotificationsProvider>
    </AuthProvider>
  );
}
