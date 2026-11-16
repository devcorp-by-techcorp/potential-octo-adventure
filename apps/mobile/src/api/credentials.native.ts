import * as SecureStore from "expo-secure-store";
import type { CredentialStore, StoredSession } from "./credentialTypes";

const KEY = "illuminate.session";

// Bearer mode: the token lives only in the platform keychain / keystore.
export const credentials: CredentialStore = {
  mode: "bearer",
  async read() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as StoredSession;
      return v && (v.role === "staff" || v.role === "client") ? v : null;
    } catch {
      return null;
    }
  },
  async write(s: StoredSession) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  },
};
