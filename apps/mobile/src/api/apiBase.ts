// Pure base-URL resolution, kept free of react-native imports so Node checks can load it.
export function resolveApiBase(platform: string, envUrl: string | undefined, dev: boolean): string {
  if (platform === "web") return envUrl ?? "";
  if (!envUrl || (!dev && !envUrl.startsWith("https:"))) {
    throw new Error("EXPO_PUBLIC_API_URL must be set to the backend's HTTPS origin");
  }
  return envUrl;
}
