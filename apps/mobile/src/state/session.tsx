/**
 * Session — real backend sign-in, restore and sign-out.
 * Web uses cookie sessions (the page never sees the token; the CSRF token
 * lives in a ref). Native keeps a bearer token in SecureStore only.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { credentials } from "~/api/credentials";
import type { Role } from "~/api/credentials";
import { apiBase } from "~/api/config";
import { ApiError, createApiClient } from "~/api/client";
import type { ApiClient } from "~/api/client";
import { readSession, signInRequest, signOutRequest } from "~/api/auth";
import type { SessionInfo } from "~/api/auth";
import { EXPIRED_MESSAGE as EXPIRED, initialSessionState, sessionReducer } from "./sessionReducer";
import type { SessionEvent, SessionState, SessionStatus } from "./sessionReducer";

export { sessionReducer, initialSessionState };
export type { SessionEvent, SessionState, SessionStatus, Role };

export type SignInResult = { ok: true } | { ok: false; error: string };

export interface SessionValue {
  status: SessionStatus;
  identity: SessionInfo["identity"] | null;
  message: string | null;
  /** True from the moment signOut() starts until its local state is cleared. */
  signingOut: boolean;
  api: ApiClient;
  /** Refused (ok: false) while a sign-out is pending, so the old sign-out cannot discard the new session. */
  signIn(role: Role, email: string, password: string): Promise<SignInResult>;
  /** Resolves once the server sign-out and local clearing are done. Await it before navigating away. */
  signOut(): Promise<void>;
  restore(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const STORE_FAILED = "We couldn't save your sign-in on this device. Please try again.";
const GENERIC = "Something went wrong. Please try again.";
export const SIGNING_OUT_MESSAGE = "You're still being signed out. Please wait a moment and try again.";
/** The server part of sign-out gives up after this; local sign-out always completes. */
const SIGN_OUT_BUDGET_MS = 8000;

const isRole = (r: unknown): r is Role => r === "staff" || r === "client";

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const stateRef = useRef<SessionState>(state);
  stateRef.current = state;
  const tokenRef = useRef<string | null>(null);
  const csrfRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const signingInRef = useRef(false);
  // The in-flight sign-in, so a sign-out that starts meanwhile waits for it and then revokes it.
  const signInRunRef = useRef<Promise<SignInResult> | null>(null);
  // The role whose token / CSRF token the refs hold. Updated synchronously, unlike stateRef,
  // which only catches up on the next render.
  const roleRef = useRef<Role | null>(null);
  // Set synchronously when signOut() starts, so a sign-in attempted in the same tick is refused.
  const signOutRef = useRef<Promise<void> | null>(null);
  const [signingOut, setSigningOut] = useState(false);
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
        roleRef.current = null;
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
          dispatch({ type: "restore-failed-unauthorized", gen, hadStored: false });
          return;
        }
        if (stale()) return;
        tokenRef.current = stored.token;
        order = [stored.role];
      } else {
        const first: Role = stored && isRole(stored.role) ? stored.role : "staff";
        order = [first, first === "staff" ? "client" : "staff"];
      }

      for (const role of order) {
        try {
          const info = await readSession(api, role, { skipUnauthorized: true });
          if (stale()) return;
          csrfRef.current = info.csrfToken;
          if (credentials.mode === "cookie") {
            try { await credentials.write({ role }); } catch { /* remembered role is a convenience */ }
          }
          if (stale()) return;
          roleRef.current = role;
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
      dispatch({ type: "restore-failed-unauthorized", gen, hadStored: stored !== null });
    } finally {
      restoringRef.current = false;
    }
  }, [api, safeClear]);

  useEffect(() => { void restore(); }, [restore]);

  const signInNow = useCallback(async (role: Role, email: string, password: string): Promise<SignInResult> => {
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
    roleRef.current = role;
    api.resetUnauthorized();
    dispatch({ type: "signed-in", role, info });
    return { ok: true };
  }, [api]);

  const signIn = useCallback(async (role: Role, email: string, password: string): Promise<SignInResult> => {
    if (signOutRef.current) return { ok: false, error: SIGNING_OUT_MESSAGE };
    if (signingInRef.current) return { ok: false, error: "Sign-in is already in progress." };
    signingInRef.current = true;
    const run = signInNow(role, email, password);
    signInRunRef.current = run;
    try { return await run; }
    finally { signingInRef.current = false; signInRunRef.current = null; }
  }, [signInNow]);

  const signOutNow = useCallback(async () => {
    // A sign-in already in flight finishes first, so its new session is the one revoked here.
    // signInNow never rejects.
    if (signInRunRef.current) await signInRunRef.current;
    const role = roleRef.current ?? stateRef.current.role;
    genRef.current += 1;
    // A hanging request must not hold the user on the splash. Aborting also stops the remaining
    // logouts, so none can land later and revoke a session signed in after this one.
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), SIGN_OUT_BUDGET_MS);
    const quiet = { skipUnauthorized: true, signal: deadline.signal };
    if (credentials.mode === "cookie") {
      // The browser may hold both portals' cookies (a portal switch does not sign out), so revoke
      // both. Each logout needs that role's own CSRF token: read the session to get it, and ignore
      // failures (a 401 just means that role was not signed in).
      const roles: Role[] = role ? [role, role === "staff" ? "client" : "staff"] : ["staff", "client"];
      for (const r of roles) {
        if (deadline.signal.aborted) break;
        try {
          const info = r === role && csrfRef.current ? null : await readSession(api, r, quiet);
          if (info) csrfRef.current = info.csrfToken;
          await signOutRequest(api, r, quiet);
        } catch { /* sign out locally whatever the server said */ }
      }
    } else if (role) {
      try { await signOutRequest(api, role, quiet); } catch { /* sign out locally whatever the server said */ }
    }
    clearTimeout(timer);
    deadline.abort();
    roleRef.current = null;
    tokenRef.current = null;
    csrfRef.current = null;
    await safeClear();
    api.resetUnauthorized();
    dispatch({ type: "signed-out" });
  }, [api, safeClear]);

  // A second call while one is pending (a double click) joins the first instead of starting another.
  const signOut = useCallback((): Promise<void> => {
    if (signOutRef.current) return signOutRef.current;
    setSigningOut(true);
    const run = (async () => {
      try { await signOutNow(); }
      finally { signOutRef.current = null; setSigningOut(false); }
    })();
    signOutRef.current = run;
    return run;
  }, [signOutNow]);

  const value = useMemo<SessionValue>(
    () => ({ status: state.status, identity: state.identity, message: state.message, signingOut, api, signIn, signOut, restore }),
    [state.status, state.identity, state.message, signingOut, api, signIn, signOut, restore]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionValue => {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
};
