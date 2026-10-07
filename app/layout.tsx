import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PortalProvider } from "@/lib/client/portal";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "4th Grade Band Carpool",
  description: "Park View Elementary 4th Grade Band carpool: parent sign-up for rehearsal rides.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Oswald:wght@500;600&family=Yellowtail&family=Cormorant+Garamond:wght@600&display=swap" />
      </head>
      <body>
        <PortalProvider>
          <Shell>{children}</Shell>
        </PortalProvider>
      </body>
    </html>
  );
}
