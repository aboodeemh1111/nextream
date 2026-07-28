import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui";
import { UploadProvider } from "@/components/upload/UploadProvider";
import { UploadTray } from "@/components/upload/UploadTray";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nextream Admin",
  description: "Admin dashboard for Nextream streaming platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`} suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              {/* Uploads live above the router so navigating between pages
                  cannot unmount an in-flight transfer. */}
              <UploadProvider>
                {children}
                <UploadTray />
              </UploadProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
