import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { type Metadata, type Viewport } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Kooks",
  description: "Surf with your crew",
  applicationName: "Kooks",
  manifest: "/manifest.json",
  // NFR-4. `capable` is what makes Safari open the installed app without browser chrome,
  // and `black-translucent` lets the navy VerdictBand paint behind the status bar (UX-DR1) —
  // the same reason `layout.tsx` carries no safe-area padding of its own.
  appleWebApp: {
    capable: true,
    title: "Kooks",
    statusBarStyle: "black-translucent",
  },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches the manifest, so the installed app's chrome is navy rather than white.
  themeColor: "#1a3a5c",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg">
        <TRPCReactProvider>
          <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-bg">
            {children}
          </div>
        </TRPCReactProvider>
        {/* Top-center: every interactive surface in this app is a bottom sheet, and a
            bottom-anchored toast sits on top of the drawer list and the check-in CTA. */}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
