/**
 * Pure session state machine. No react / react-native / expo imports, so node
 * can transpile and test it (e2e/session-state.js).
 */
import type { Role } from "../api/credentialTypes";
import type { SessionInfo } from "../api/auth";

export type SessionStatus = "restoring" | "signed-out" | "staff" | "client" | "unavailable";

export interface SessionState {
  status: SessionStatus;
  identity: SessionInfo["identity"] | null;
  /** The last role seen; kept through "unavailable" so a retry knows where to look. */
  role: Role | null;
  message: string | null;
}

export type SessionEvent =
  | { type: "restored"; role: Role; info: SessionInfo }
  | { type: "restore-failed-unauthorized" }
  | { type: "restore-failed-unavailable" }
  | { type: "signed-in"; role: Role; info: SessionInfo }
  | { type: "signed-out"; message?: string };

export const initialSessionState: SessionState = { status: "restoring", identity: null, role: null, message: null };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "restored":
    case "signed-in":
      return { status: event.role, identity: event.info.identity, role: event.role, message: null };
    case "restore-failed-unauthorized":
      return { status: "signed-out", identity: null, role: null, message: null };
    case "restore-failed-unavailable":
      return { ...state, status: "unavailable" };
    case "signed-out":
      return { status: "signed-out", identity: null, role: null, message: event.message ?? null };
    default:
      return state;
  }
}
