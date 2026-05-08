import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0f0a",
};

export const metadata: Metadata = {
  title: "PIP-BOY 3000 ULTIMATE",
  description: "Pip-Boy Ultimate — Maps, Habits, Notes, RPG Stats. Fallout-style personal organizer. By Sandalf Studio.",
  manifest: "/pipboy-ultimate/manifest.json",
  icons: {
    icon: "/pipboy-ultimate/favicon.svg",
    apple: "/pipboy-ultimate/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PIP-BOY ULTIMATE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/pipboy-ultimate/icon-192.png" />
      </head>
      <body className="bg-[#0a0f0a] text-[#00ff00] overflow-hidden">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
