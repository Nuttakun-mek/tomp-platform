import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { getRequestLocale } from "@/lib/i18n/server";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-thai",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "TOMP — Transportation Operations Management Platform",
  description: "ระบบบริหารจัดการการเดินทางและบริการ",
  applicationName: "TOMP"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body className={notoSansThai.variable}>{children}</body>
    </html>
  );
}
