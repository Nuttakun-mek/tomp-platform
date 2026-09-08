import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow the dev server's /_next/* assets to be requested from a phone or
  // other device on the LAN (e.g. when opening the driver QR link locally).
  allowedDevOrigins: ["172.20.10.3", "localhost", "127.0.0.1"],
  async redirects() {
    return [
      { source: "/admin", destination: "/superadmin", permanent: false },
      { source: "/admin/pilot-smoke-test", destination: "/superadmin/dev-tools/smoke-test", permanent: false },
      { source: "/admin/data-quality", destination: "/superadmin/dev-tools/data-quality", permanent: false },
      { source: "/admin/enterprise-readiness", destination: "/superadmin/dev-tools/readiness", permanent: false },
      { source: "/admin/operations", destination: "/superadmin/dev-tools/runbook", permanent: false },
      { source: "/live-test", destination: "/superadmin/dev-tools/live-test", permanent: false },
      { source: "/pilot-checklist", destination: "/superadmin/dev-tools/pilot-checklist", permanent: false }
    ];
  }
};

export default nextConfig;
