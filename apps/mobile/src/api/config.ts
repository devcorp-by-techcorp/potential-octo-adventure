import { Platform } from "react-native";
import { resolveApiBase } from "./apiBase";

export { resolveApiBase };

/** The backend origin: same origin ("") on web, EXPO_PUBLIC_API_URL on native. */
export function apiBase(): string {
  return resolveApiBase(Platform.OS, process.env.EXPO_PUBLIC_API_URL, __DEV__);
}
