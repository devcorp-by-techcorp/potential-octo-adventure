const baseUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export async function api(path, body) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(75000),
    });
  } catch {
    throw new Error(
      "We couldn’t reach the studio. Please try again or contact us by email.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check your details and try again.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
