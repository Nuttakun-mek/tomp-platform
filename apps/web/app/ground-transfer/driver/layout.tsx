import type { Viewport } from "next";

// Pinned like a native screen: no pinch or double-tap zoom, and drawn under the
// notch so the safe-area padding below means something. The app used to set
// this from its injected script, which failed on every build up to 1.0.0 (9),
// so pages zoomed like a website. Declared here it holds in any build.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f766e"
};

// Driver view — no app shell, no nav. A driver only ever sees their one job.
// This screen is also the basis for the mobile app webview, so it must stay a
// single narrow column that works from ~320px up and respects device safe areas.
export default function DriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="min-h-[100svh] bg-canvas text-ink"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      <div className="mx-auto w-full max-w-[520px] px-3 py-4 sm:px-4">{children}</div>
    </div>
  );
}
