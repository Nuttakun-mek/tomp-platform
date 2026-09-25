import type { Viewport } from "next";
import "./driver-dark.css";

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
// Decides light or dark before the first paint. The app can force a choice by
// setting <html data-driver-theme="light|dark"> (its own theme setting); without
// that the page follows the phone. Sets data-driver-dark, which driver-dark.css
// keys on, and follows the phone if it switches while the page is open.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;var q=window.matchMedia("(prefers-color-scheme: dark)");function apply(){var t=d.getAttribute("data-driver-theme");var dark=t==="dark"||(t!=="light"&&q.matches);if(dark)d.setAttribute("data-driver-dark","");else d.removeAttribute("data-driver-dark");}apply();q.addEventListener("change",apply);new MutationObserver(apply).observe(d,{attributes:true,attributeFilter:["data-driver-theme"]});}catch(e){}})();`;

export default function DriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="driver-theme min-h-[100svh] bg-canvas text-ink"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="mx-auto w-full max-w-[520px] px-3 py-4 sm:px-4">{children}</div>
    </div>
  );
}
