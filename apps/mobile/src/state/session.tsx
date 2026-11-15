/**
 * Session — real backend sign-in, restore and sign-out.
 * Web uses cookie sessions (the page never sees the token; the CSRF token
 * lives in a ref). Native keeps a bearer token in SecureStore only.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { credentials } from "~/api/credentials";
import type { Role } from "~/api/credentials";
import { apiBase } from "~/api/config";
import { ApiError, createApiClient } from "~/api/client";
import type { ApiClient } from "~/api/client";
import { readSession, signInRequest, signOutRequest } from "~/api/auth";
import type { SessionInfo } from "~/api/auth";
import { initialSessionState, sessionReducer } from "./sessionReducer";
import type { SessionEvent, SessionState, SessionStatus } from "./sessionReducer";

export { sessionReducer, initialSessionState };
export type { SessionEvent, SessionState, SessionStatus, Role };

export type SignInResult = { ok: true } | { ok: false; error: string };

export interface SessionValue {
  status: SessionStatus;
  identity: SessionInfo["identity"] | null;
  message: string | null;
  api: ApiClient;
  signIn(role: Role, email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  restore(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const EXPIRED = "Your session has expired. Please sign in again.";
const STORE_FAILED = "We couldn't save your sign-in on this device. Please try again.";
const GENERIC = "Something went wrong. Please try again.";

const isRole = (r: unknown): r is Role => r === "staff" || r === "client";

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const stateRef = useRef<SessionState>(state);
  stateRef.current = state;
  const tokenRef = useRef<string | null>(null);
  const csrfRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const signingInRef = useRef(false);
  // Mirrors SessionState.gen: bumped synchronously wherever signed-in / signed-out is dispatched.
  const genRef = useRef(0);

  const safeClear = useCallback(async () => {
    try { await credentials.clear(); } catch { /* local state is cleared regardless */ }
  }, []);

  const api = useMemo<ApiClient>(() => {
    return createApiClient({
      base: apiBase(),
      mode: credentials.mode,
      fetch: (...a) => fetch(...a),
      getToken: () => tokenRef.current,
      getCsrf: () => csrfRef.current,
      onUnauthorized: (message) => {
        // A 401 while restoring is an answer, not an expiry; restore() handles it.
        if (restoringRef.current) return;
        tokenRef.current = null;
        csrfRef.current = null;
        genRef.current += 1;
        void safeClear();
        dispatch({ type: "signed-out", message: message || EXPIRED });
      },
    });
  }, [safeClear]);

  const restore = useCallback(async () => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    const gen = genRef.current;
    const stale = () => genRef.current !== gen;
    try {
      let stored: Awaited<ReturnType<typeof credentials.read>> = null;
      try { stored = await credentials.read(); } catch { stored = null; }

      let order: Role[];
      if (credentials.mode === "bearer") {
        if (!stored || !isRole(stored.role) || typeof stored.token !== "string" || !stored.token) {
          if (stale()) return;
          await safeClear();
          if (stale()) return;
          dispatch({ type: "restore-failed-unauthorized", gen });
          return;
        }
        tokenRef.current = stored.token;
        order = [stored.role];
      } else {
        const first: Role = stored && isRole(stored.role) ? stored.role : "staff";
        order = [first, first === "staff" ? "client" : "staff"];
      }

      for (const role of order) {
        try {
          const info = await readSession(api, role);
          if (stale()) return;
          csrfRef.current = info.csrfToken;
          if (credentials.mode === "cookie") {
            try { await credentials.write({ role }); } catch { /* remembered role is a convenience */ }
          }
          if (stale()) return;
          api.resetUnauthorized();
          dispatch({ type: "restored", role, info, gen });
          return;
        } catch (e) {
          if (stale()) return;
          if (e instanceof ApiError && e.kind === "unauthorized") continue;
          dispatch({ type: "restore-failed-unavailable", gen });
          return;
        }
      }
      if (stale()) return;
      tokenRef.current = null;
      csrfRef.current = null;
      await safeClear();
      if (stale()) return;
      api.resetUnauthorized();
      dispatch({ type: "restore-failed-unauthorized", gen });
    } finally {
      restoringRef.current = false;
    }
  }, [api, safeClear]);

  useEffect(() => { void restore(); }, [restore]);

  const signIn = useCallback(async (role: Role, email: string, password: string): Promise<SignInResult> => {
    if (signingInRef.current) return { ok: false, error: "Sign-in is already in progress." };
    signingInRef.current = true;
    try {
      let info: SessionInfo;
      try {
        info = await signInRequest(api, credentials.mode, role, email.trim(), password);
      } catch (e) {
        return { ok: false, error: e instanceof ApiError ? e.message : GENERIC };
      }
      genRef.current += 1; // any restore still in flight is now stale
      try {
        if (credentials.mode === "bearer") {
          if (!info.token) { dispatch({ type: "signed-out" }); return { ok: false, error: GENERIC }; }
          await credentials.write({ role, token: info.token });
          tokenRef.current = info.token;
        } else {
          await credentials.write({ role });
        }
      } catch {
        tokenRef.current = null;
        dispatch({ type: "signed-out" });
        return { ok: false, error: STORE_FAILED };
      }
      csrfRef.current = info.csrfToken;
      api.resetUnauthorized();
      dispatch({ type: "signed-in", role, info });
      return { ok: true };
    } finally {
      signingInRef.current = false;
    }
  }, [api]);

  const signOut = useCallback(async () => {
    const role = stateRef.current.role;
    genRef.current += 1;
    if (role) {
      try { await signOutRequest(api, role); } catch { /* sign out locally whatever the server said */ }
    }
    tokenRef.current = null;
    csrfRef.current = null;
    await safeClear();
    api.resetUnauthorized();
    dispatch({ type: "signed-out" });
  }, [api, safeClear]);

  const value = useMemo<SessionValue>(
    () => ({ status: state.status, identity: state.identity, message: state.message, api, signIn, signOut, restore }),
    [state.status, state.identity, state.message, api, signIn, signOut, restore]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionValue => {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
};
