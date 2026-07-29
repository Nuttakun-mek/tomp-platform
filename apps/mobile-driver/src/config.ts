import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as { tompApiBaseUrl?: string } | undefined;

export const TOMP_API_BASE_URL =
  process.env.EXPO_PUBLIC_TOMP_API_BASE_URL ||
  extra?.tompApiBaseUrl ||
  "https://tomp-platform.vercel.app";

export const LOCATION_TASK_NAME = "tomp-driver-background-location";
