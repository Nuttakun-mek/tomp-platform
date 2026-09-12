#!/usr/bin/env node
// Cuts every app-icon asset the driver app needs out of one brand artwork, so
// the icons are reproducible instead of five PNGs nobody can regenerate.
//
//   node scripts/make-app-icons.mjs
//
// Source: apps/mobile-driver/branding/tomp-logo.jpg — deliberately NOT under
// assets/, because app.json bundles assets/**/* into the app and the 260KB
// original would ride along for nothing.
//
// Doing this by hand is the trap. The three platforms want contradictory
// things out of the same picture:
//
//   iOS       an opaque square. Alpha is rejected at upload, and iOS applies
//             its own squircle, so the artwork must bleed to every edge.
//   Android   a foreground whose content survives being masked to a circle by
//             the launcher. Only the middle ~66% is guaranteed to be visible.
//   notif.    a white silhouette on transparency. Android throws the colours
//             away and keeps the alpha channel; anything else is a grey blob.
//
// The artwork also ships with its own white margin and rounded corners, which
// would show as white slivers inside the system's own rounding. trim() takes
// the margin; the crop boxes below start inside the corner radius.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The artwork is photographic, so a straight PNG encode of it runs to ~1.5MB
// per file and all of it ships inside the app. Quantising to a palette takes
// that down by roughly 10x; at icon sizes the banding it can cause in a
// gradient is not visible.
const PNG = { palette: true, quality: 90, compressionLevel: 9 };

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const APP = path.join(ROOT, "apps", "mobile-driver");
const SOURCE = path.join(APP, "branding", "tomp-logo.jpg");
const OUT = path.join(APP, "assets");

// Crop boxes in the *trimmed* artwork's coordinates (1142x1194 for the current
// logo). Replacing the artwork means re-tuning these three numbers — run with
// --probe to print the trimmed size and the largest corner-free square.
const ICON_CROP = { left: 246, top: 20, width: 660, height: 660 };
// Wider than the icon crop so the launcher's circle does not clip the ends of
// the TOMP wordmark. At the wordmark's height a circle keeps only ~90% of the
// frame width, and the wordmark is 90% wide, so it lands exactly on the edge.
const ANDROID_CROP = { left: 196, top: 0, width: 760, height: 760 };
// The splash gets the whole picture, margin and rounded corners included, and
// is shown on a white background — the artwork's own white surround then blends
// into the screen instead of reading as a photo pasted onto a colour. It is the
// one place the detail pays off, because it is 220dp wide rather than 15.

// The notification icon cannot come from the artwork: reduced to pure alpha at
// 96px, the wordmark and the cars turn to mud. This redraws the logo's own idea
// — a location pin with a T in it — as a single flat shape. Head circle centred
// (512,430) r=215 tapering to a tip at (512,880); 323.1/700.9 are the tangent
// points where the circle meets the straight edges, and rounding them leaves a
// visible kink.
const PIN = "M 323.1 532.7 A 215 215 0 1 1 700.9 532.7 L 512 880 Z";
const NOTIFICATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <mask id="cut">
    <rect width="1024" height="1024" fill="black"/>
    <g transform="translate(512,512) scale(0.78) translate(-512,-547.5)">
      <path d="${PIN}" fill="white"/>
      <g fill="black">
        <rect x="397" y="330" width="230" height="66" rx="16"/>
        <rect x="479" y="330" width="66" height="210" rx="16"/>
      </g>
    </g>
  </mask>
  <rect width="1024" height="1024" fill="white" mask="url(#cut)"/>
</svg>`;

/** The artwork with its white margin removed, as a buffer. */
async function trimmed() {
  return sharp(SOURCE).trim({ threshold: 12 }).toBuffer();
}

async function probe() {
  const art = await trimmed();
  const raw = await sharp(art).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = raw.info;
  const isWhite = (x, y) => {
    const i = (y * W + x) * C;
    return raw.data[i] > 245 && raw.data[i + 1] > 245 && raw.data[i + 2] > 245;
  };
  let lo = 100;
  let hi = Math.min(W, H);
  while (hi - lo > 1) {
    const side = Math.floor((lo + hi) / 2);
    const h = side / 2;
    const corners = [
      [W / 2 - h, H / 2 - h],
      [W / 2 + h - 1, H / 2 - h],
      [W / 2 - h, H / 2 + h - 1],
      [W / 2 + h - 1, H / 2 + h - 1]
    ];
    if (corners.every(([x, y]) => !isWhite(Math.round(x), Math.round(y)))) lo = side;
    else hi = side;
  }
  console.log(`trimmed artwork: ${W}x${H}`);
  console.log(`largest centred square clear of the rounded corners: ${lo}`);
  console.log(`  -> { left: ${Math.round(W / 2 - lo / 2)}, top: ${Math.round(H / 2 - lo / 2)}, width: ${lo}, height: ${lo} }`);
}

async function build() {
  const art = await trimmed();
  await fs.mkdir(OUT, { recursive: true });

  const written = [];
  const cut = async (file, crop, size) => {
    const out = path.join(OUT, file);
    await sharp(art).extract(crop).resize(size, size).png(PNG).toFile(out);
    written.push(`${file}  ${size}px  ${Math.round((await fs.stat(out)).size / 1024)}KB`);
  };

  await cut("icon.png", ICON_CROP, 1024);
  await cut("adaptive-icon.png", ANDROID_CROP, 1024);
  const splash = path.join(OUT, "splash-icon.png");
  await sharp(SOURCE).resize(1024, 1024).png(PNG).toFile(splash);
  written.push(`splash-icon.png  1024px (untrimmed)  ${Math.round((await fs.stat(splash)).size / 1024)}KB`);
  await cut("favicon.png", ICON_CROP, 48);

  await sharp(Buffer.from(NOTIFICATION_SVG)).resize(96, 96).png().toFile(path.join(OUT, "notification-icon.png"));
  written.push("notification-icon.png  96px");

  for (const line of written) console.log(`  apps/mobile-driver/assets/${line}`);
  console.log(`\n${written.length} files written. Icons are baked in at build time — rebuild to see them.`);
}

if (process.argv.includes("--probe")) await probe();
else await build();
