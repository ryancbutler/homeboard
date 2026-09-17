import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-service-worker";

export const metadata: Metadata = {
  title: "Homeboard — Little chores, big teamwork",
  description: "Your family's shared home for chores, routines, and everyday wins.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Homeboard", statusBarStyle: "black-translucent" }
};
export const viewport: Viewport = { themeColor: "#fcf9f3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RegisterServiceWorker />{children}</body></html>;
}
