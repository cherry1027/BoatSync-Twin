import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoatSync Twin — Offline-First Edge Digital Twin",
  description: "Interactive research prototype for offline command queues, conflict resolution, and marine digital twin synchronization.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
