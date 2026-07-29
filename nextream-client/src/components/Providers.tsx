'use client';

import { AuthProvider } from "@/context/AuthContext";
import { DiscoveryProvider } from "@/context/DiscoveryContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SearchProvider } from "@/components/search/SearchProvider";
import ToastStack from "@/components/notifications/ToastStack";

/**
 * Notifications sit inside auth because they are per-viewer: the provider keys its
 * stream and its state on the access token, and mounting it above auth would give
 * it nothing to subscribe to.
 *
 * Discovery is inside auth for the same reason and one more: the taste profile it
 * builds is stored on the device, and it has to know when the account changed so
 * it can forget the previous one's.
 *
 * ToastStack renders here rather than in a page so a notification arriving while
 * the viewer is anywhere in the app has somewhere to appear.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <DiscoveryProvider>
          <SearchProvider>{children}</SearchProvider>
        </DiscoveryProvider>
        <ToastStack />
      </NotificationsProvider>
    </AuthProvider>
  );
}
