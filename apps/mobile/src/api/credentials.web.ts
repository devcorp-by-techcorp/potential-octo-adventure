import type { CredentialStore, StoredSession } from "./credentialTypes";

const KEY = "illuminate.lastRole";

// Cookie mode: the browser holds the session cookie. Only the last role is remembered, never a token.
export const credentials: CredentialStore = {
  mode: "cookie",
  async read() {
    try {
      const role = globalThis.localStorage?.getItem(KEY);
      return role === "staff" || role === "client" ? { role } : null;
    } catch {
      return null;
    }
  },
  async write(s: StoredSession) {
    try {
      globalThis.localStorage?.setItem(KEY, s.role);
    } catch {
      // storage unavailable; the role is only a convenience
    }
  },
  async clear() {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
