import Constants from "expo-constants";
import { Platform } from "react-native";

// Read from the installed build, never typed by hand: a hard-coded "0.2.0" kept
// showing on build 1.0.0 (7) and made it look like the wrong app was installed.
export const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

const NATIVE_BUILD =
  Platform.OS === "ios" ? Constants.expoConfig?.ios?.buildNumber : String(Constants.expoConfig?.android?.versionCode ?? "");

/** "1.0.0+7" — what GPS pings carry, so a gap in the data says which build sent it. */
export const APP_BUILD = NATIVE_BUILD ? `${APP_VERSION}+${NATIVE_BUILD}` : APP_VERSION;

/** "1.0.0 (7)" — what a person reads on screen. */
export const APP_VERSION_LABEL = NATIVE_BUILD ? `${APP_VERSION} (${NATIVE_BUILD})` : APP_VERSION;
