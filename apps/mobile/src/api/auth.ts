import type { ApiClient, RequestOptions } from "./client";
import type { Mode, Role } from "./credentialTypes";

export interface SessionInfo {
  identity: { id: string; email: string; name: string };
  expiresAt: string;
  csrfToken: string | null;
  token?: string;
}

interface SessionWire {
  identity: SessionInfo["identity"];
  expires_at: string;
  csrf_token?: string | null;
  token?: string;
}

function toSession(w: SessionWire): SessionInfo {
  const info: SessionInfo = { identity: w.identity, expiresAt: w.expires_at, csrfToken: w.csrf_token ?? null };
  if (w.token) info.token = w.token;
  return info;
}

const prefix = (role: Role) => (role === "client" ? "/api/auth/client" : "/api/auth");

export async function signInRequest(api: ApiClient, mode: Mode, role: Role, email: string, password: string, signal?: AbortSignal): Promise<SessionInfo> {
  const path = `${prefix(role)}/${mode === "bearer" ? "token" : "login"}`;
  return toSession(await api.request<SessionWire>("POST", path, { email, password }, { skipUnauthorized: true, signal }));
}

export async function readSession(api: ApiClient, role: Role, options?: RequestOptions): Promise<SessionInfo> {
  return toSession(await api.request<SessionWire>("GET", `${prefix(role)}/session`, undefined, options));
}

export async function signOutRequest(api: ApiClient, role: Role, options?: RequestOptions): Promise<void> {
  await api.request<void>("POST", `${prefix(role)}/logout`, role === "client" ? {} : undefined, options);
}
