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
  /** Bumped by every signed-in / signed-out; restore events from an older generation are stale. */
  gen: number;
}

export type SessionEvent =
  | { type: "restored"; role: Role; info: SessionInfo; gen: number }
  /** `hadStored`: credentials existed when the restore began, so a 401 means they expired or were revoked. */
  | { type: "restore-failed-unauthorized"; gen: number; hadStored?: boolean }
  | { type: "restore-failed-unavailable"; gen: number }
  | { type: "signed-in"; role: Role; info: SessionInfo }
  | { type: "signed-out"; message?: string };

export const EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export const initialSessionState: SessionState = { status: "restoring", identity: null, role: null, message: null, gen: 0 };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  if ((event.type === "restored" || event.type === "restore-failed-unauthorized" || event.type === "restore-failed-unavailable") && event.gen !== state.gen) {
    return state; // a sign-in or sign-out finished while this restore was in flight
  }
  switch (event.type) {
    case "restored":
      return { status: event.role, identity: event.info.identity, role: event.role, message: null, gen: state.gen };
    case "signed-in":
      return { status: event.role, identity: event.info.identity, role: event.role, message: null, gen: state.gen + 1 };
    case "restore-failed-unauthorized":
      return { status: "signed-out", identity: null, role: null, message: event.hadStored ? EXPIRED_MESSAGE : null, gen: state.gen };
    case "restore-failed-unavailable":
      return { ...state, status: "unavailable" };
    case "signed-out":
      return { status: "signed-out", identity: null, role: null, message: event.message ?? null, gen: state.gen + 1 };
    default:
      return state;
  }
}
