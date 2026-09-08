import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import IOSPinchZoomGuard from "@/components/IOSPinchZoomGuard";
import DisableNativeContextMenu from "@/components/DisableNativeContextMenu";
import OnboardingProvider from "@/components/onboarding/OnboardingProvider";
import GuestRouteGuard from "@/components/GuestRouteGuard";
import GuestGateProvider from "@/components/GuestGateProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://reccool.com"),
  title: "ReCCool",
  applicationName: "ReCCool",
  description:
    "Red social para descubrir, calificar, recomendar y compartir películas y series.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ReCCool",
  },
  icons: {
    apple: "/icons/pwa/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-black text-zinc-100 antialiased`}
      >
        <ServiceWorkerRegistration />
        <IOSPinchZoomGuard />
        <DisableNativeContextMenu />
        <GuestRouteGuard />
        <GuestGateProvider>{children}</GuestGateProvider>
        <OnboardingProvider />
      </body>
    </html>
  );
}
