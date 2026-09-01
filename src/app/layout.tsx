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
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg">
        <TRPCReactProvider>
          <div className="max-w-[430px] mx-auto min-h-screen bg-bg pt-safe pb-safe">
            {children}
          </div>
        </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
