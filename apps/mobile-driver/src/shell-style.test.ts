import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { colors, font, space, text, TOUCH_MIN } from "./theme";

// The shell's look is defined in theme.ts, and App.tsx is meant to spend it,
// not reinvent it. Before this guard the shell carried nine font sizes,
// forty-four raw hex values and two touch targets a driver could miss.
// Every one of those grew back at least once during a redesign.
const shell = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("the shell spends the theme instead of inventing values", () => {
  it("has no raw hex colours", () => {
    expect(shell.match(/"#[0-9a-fA-F]{3,8}"/g) ?? []).toEqual([]);
  });

  it("sets no font size that is not a step on the scale", () => {
    // `fontSize: text.caption.fontSize` is allowed — it is the scale, read for
    // a value that has to match a fixed 24px circle.
    expect(shell.match(/fontSize: \d/g) ?? []).toEqual([]);
  });

  it("sets no fontWeight", () => {
    // With a custom family Android either ignores fontWeight or fakes a second
    // bold on top of an already-bold file, which is what made the shell shout.
    // The family name carries the weight.
    // The declaration, not the word: the file explains in a comment why
    // fontWeight is gone, and that comment should not trip its own guard.
    expect(shell.match(/fontWeight\s*:/g) ?? []).toEqual([]);
  });

  it("no longer guesses the Android gesture bar", () => {
    expect(shell).not.toContain("ANDROID_NAVIGATION_BAR_GUARD");
    expect(shell).toContain("useSafeAreaInsets");
    expect(shell).toContain("SafeAreaProvider");
  });

  it("tells the web page the real platform and background capability", () => {
    // The shell used to inject platform: "android" on both platforms, and
    // canBackgroundLocation: true regardless. The web reads the second one.
    expect(shell).not.toContain('platform: "android"');
    expect(shell).not.toContain("canBackgroundLocation: true");
  });
});

describe("the shell keeps the web page in touch with the phone", () => {
  it("opens Geolocation to the page inside the WebView", () => {
    // Android WebView defaults Geolocation off, which left navigator.geolocation
    // dead inside the shell while the app's own GPS reported fine over the
    // bridge. The driver page calls it directly to stamp a photo, so every
    // picture waited out an 8s timeout and then printed no coordinates at all.
    expect(shell).toContain("geolocationEnabled");
  });

  it("repeats the GPS status after a load instead of answering once", () => {
    // The GPS tab asks for status itself and survives a missed answer. The job
    // tab only listens, so a status that lands before React attaches the
    // listener is gone for good and its dot stays dark through a live session.
    expect(shell).toMatch(/setTimeout\(\(\) => void postLocationSharingStatus\(\), \d+\)/);
  });
});

describe("the theme itself", () => {
  it("pairs every text step with a line height Thai can breathe in", () => {
    for (const [name, step] of Object.entries(text)) {
      // Tone marks sit above the character and lower vowels below it; at 1.2
      // the marks are clipped by the line box.
      expect(step.lineHeight / step.fontSize, name).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("keeps only the three weights that are loaded", () => {
    expect(Object.values(font)).toEqual([
      "NotoSansThai_400Regular",
      "NotoSansThai_600SemiBold",
      "NotoSansThai_700Bold"
    ]);
  });

  it("holds a touch minimum a driver can hit in a moving vehicle", () => {
    expect(TOUCH_MIN).toBeGreaterThanOrEqual(44);
  });

  it("exposes a spacing scale and the colours the shell needs", () => {
    expect(Object.keys(space)).toEqual(["xs", "sm", "md", "lg", "xl", "xxl"]);
    expect(colors.accent).toBeTruthy();
    expect(colors.onCommand).toBeTruthy();
  });
});
