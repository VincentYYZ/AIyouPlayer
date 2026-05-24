import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/app/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "AIyouPlayer",
  description: "AI 驱动的音频伴侣 — Aurora 玻璃拟态界面",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06081a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <div className="aurora-bg" aria-hidden />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
