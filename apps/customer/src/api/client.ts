// Custom HTTP Client with automatic Bearer token injection and refresh rotation

const TOKEN_KEY = "sanitary_access_token";
const REFRESH_KEY = "sanitary_refresh_token";

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${normalizedEndpoint}`;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const token = getStoredAccessToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob)
  ) {
    headers.set("Content-Type", "application/json");
  }

  // Use caller's signal if provided; otherwise use our timeout controller's signal
  // This preserves the ability for callers to cancel in-flight requests
  const controller = new AbortController();
  const timeoutMs = 20000; // 20s — accommodates slow 2G/3G mobile connections
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ?? controller.signal;

  let response: Response;
  const targetUrl = resolveUrl(endpoint);
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers,
      signal,
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
      throw {
        status: 408,
        code: "TIMEOUT",
        message: "Network request timed out. Please check that the server is reachable.",
      };
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle 401 Unauthorized by attempting rotating token refresh
  if (response.status === 401 && !retried) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(resolveUrl("/auth/refresh"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const data = (await refreshRes.json()) as {
              accessToken: string;
              refreshToken: string;
            };
            setStoredTokens(data.accessToken, data.refreshToken);
            onRefreshed(data.accessToken);
            isRefreshing = false;
            return apiClient<T>(endpoint, options, true);
          } else {
            clearStoredTokens();
            onRefreshed(null);
            isRefreshing = false;
          }
        } catch {
          clearStoredTokens();
          onRefreshed(null);
          isRefreshing = false;
        }
      } else {
        // Wait for active refresh
        return new Promise<T>((resolve, reject) => {
          refreshSubscribers.push((newToken) => {
            if (newToken) {
              resolve(apiClient<T>(endpoint, options, true));
            } else {
              reject({ status: 401, code: "UNAUTHORIZED", message: "Session expired" });
            }
          });
        });
      }
    }
  }

  if (!response.ok) {
    let errBody: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      errBody = await response.json();
    } catch {
      // Non-JSON error body
    }
    const err: ApiError = {
      status: response.status,
      code: errBody.error?.code || `HTTP_${response.status}`,
      message: errBody.error?.message || response.statusText || "Request failed",
      details: errBody.error?.details,
    };
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
