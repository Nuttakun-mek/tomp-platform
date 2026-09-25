import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

// Read from the installed build, never typed by hand: a hard-coded "0.2.0" kept
// showing on build 1.0.0 (7) and made it look like the wrong app was installed.
export const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

const NATIVE_BUILD =
  Platform.OS === "ios" ? Constants.expoConfig?.ios?.buildNumber : String(Constants.expoConfig?.android?.versionCode ?? "");

// An over-the-air update keeps the app version on purpose — runtimeVersion
// follows it, and a new version number would stop every installed build from
// taking the update — so which update is running is shown beside it instead.
// Null while the build's own embedded code is running.
const OTA = !Updates.isEmbeddedLaunch && Updates.updateId ? { id: Updates.updateId.slice(0, 8), createdAt: Updates.createdAt } : null;

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "1.0.0+10" or "1.0.0+10~2731979c" — what GPS pings carry, so a gap in the data says which code sent it. */
export const APP_BUILD = `${NATIVE_BUILD ? `${APP_VERSION}+${NATIVE_BUILD}` : APP_VERSION}${OTA ? `~${OTA.id}` : ""}`;

/** "1.0.0 (10)" or "1.0.0 (10) · อัปเดต 25/09 17:26" — what a person reads on screen. */
export const APP_VERSION_LABEL = `${NATIVE_BUILD ? `${APP_VERSION} (${NATIVE_BUILD})` : APP_VERSION}${
  OTA ? ` · อัปเดต ${OTA.createdAt ? stamp(OTA.createdAt) : OTA.id}` : ""
}`;
