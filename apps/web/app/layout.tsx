import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-thai",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "TOMP",
  description: "แพลตฟอร์มควบคุมปฏิบัติการขนส่ง",
  applicationName: "TOMP"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={notoSansThai.variable}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
