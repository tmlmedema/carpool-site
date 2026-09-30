import type { Metadata } from "next";
import { Roboto, Roboto_Slab } from "next/font/google";
import { PortalProvider } from "@/components/PortalProvider";
import { Shell } from "@/components/Shell";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-roboto" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-slab" });

export const metadata: Metadata = {
  title: "4th Grade Band Carpool",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoSlab.variable}`}>
      <body>
        <PortalProvider>
          <Shell>{children}</Shell>
        </PortalProvider>
      </body>
    </html>
  );
}
