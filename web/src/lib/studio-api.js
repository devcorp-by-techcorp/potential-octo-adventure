const baseUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export async function privateApi(path, { body, csrf, signal, method, scope = "Studio" } = {}) {
  const unavailable = `${scope} access is temporarily unavailable. Please try again.`;
  let response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method: method || (body !== undefined ? "POST" : "GET"),
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (cause) {
    if (cause.name === "AbortError") throw cause;
    throw new Error(unavailable);
  }
  const data = response.status === 204 ? {} : await response.json().catch(() => null);
  if (response.ok && data === null) {
    throw new Error(unavailable);
  }
  if (!response.ok) {
    const error = new Error(
      typeof data?.detail === "string"
        ? data.detail
        : unavailable,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}

export const studioApi = (path, options) => privateApi(path, options);
export const clientApi = (path, options) => privateApi(path, { ...options, scope: "Client" });
