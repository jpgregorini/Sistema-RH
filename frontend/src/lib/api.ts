const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Transient statuses worth one retry (gateway / temporarily unavailable).
const RETRY_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  // POST may create resources — never auto-retry it. Other verbs are safe.
  const retryable = method !== "POST";

  let lastErr: unknown;
  for (let attempt = 0; attempt < (retryable ? 2 : 1); attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!res.ok) {
        // Retry once on transient gateway errors.
        if (retryable && attempt === 0 && RETRY_STATUS.has(res.status)) {
          await sleep(400);
          continue;
        }
        const error = await res.text();
        throw new Error(error || `Request failed: ${res.status}`);
      }

      return res.json();
    } catch (err) {
      lastErr = err;
      // Network error (fetch threw) — retry once for safe verbs.
      const isNetwork = err instanceof TypeError;
      if (retryable && attempt === 0 && isNetwork) {
        await sleep(400);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T = unknown>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  upload: async <T = unknown>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};
