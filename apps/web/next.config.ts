import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow the dev server's /_next/* assets to be requested from a phone or
  // other device on the LAN (e.g. when opening the driver QR link locally).
  allowedDevOrigins: ["172.20.10.3", "localhost", "127.0.0.1"]
};

export default nextConfig;
