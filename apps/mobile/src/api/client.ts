import type { Mode } from "./credentialTypes";

export type ApiErrorKind = "unauthorized" | "forbidden" | "not_found" | "conflict" | "invalid" | "rate_limited" | "unavailable" | "other";

export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;
  constructor(status: number, kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
}

function kindFor(status: number): ApiErrorKind {
  switch (status) {
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 409: return "conflict";
    case 422: return "invalid";
    case 429: return "rate_limited";
    case 503: return "unavailable";
    default: return "other";
  }
}

export interface ApiClient {
  request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T>;
  resetUnauthorized(): void;
}

export interface ApiClientDeps {
  base: string;
  mode: Mode;
  fetch: typeof fetch;
  getToken(): string | null;
  getCsrf(): string | null;
  onUnauthorized(message: string): void;
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  let unauthorizedFired = false;

  async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    if (deps.mode === "cookie") {
      init.credentials = "include";
      const csrf = deps.getCsrf();
      if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
    } else {
      const token = deps.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await deps.fetch(deps.base + path, init);
    } catch {
      throw new ApiError(0, "unavailable", "Could not reach the server");
    }

    if (!response.ok) {
      let detail = "";
      try {
        const data = JSON.parse(await response.text());
        if (data && typeof data.detail === "string") detail = data.detail;
      } catch {
        // non-JSON error body
      }
      const kind = kindFor(response.status);
      const message = detail || `Request failed (${response.status})`;
      if (kind === "unauthorized" && !unauthorizedFired) {
        unauthorizedFired = true;
        deps.onUnauthorized(message);
      }
      throw new ApiError(response.status, kind, message);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    request,
    resetUnauthorized() {
      unauthorizedFired = false;
    },
  };
}
