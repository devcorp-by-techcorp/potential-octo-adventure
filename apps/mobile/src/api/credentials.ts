// Types and a typecheck-only value. Metro picks credentials.web.ts or credentials.native.ts by platform.
export type { Role, Mode, StoredSession, CredentialStore } from "./credentialTypes";
export { credentials } from "./credentials.native";
