import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // Web 环境下使用当前页面 origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // 非 Web 环境使用环境变量
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    return '';
  }

  const protocol = host.startsWith('localhost') || host.match(/^\d/) ? 'http' : 'https';
  let url = new URL(`${protocol}://${host}`);

  return url.href;
}

export function buildUrl(path: string): string {
  const baseUrl = getApiUrl();
  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}

let cachedCsrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export async function getCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedCsrfToken) return cachedCsrfToken;
  if (!forceRefresh && csrfRequest) return csrfRequest;
  csrfRequest = (async () => {
    const response = await fetch(buildUrl("/api/auth/csrf-token"), { credentials: "include" });
    await throwIfResNotOk(response);
    const data = await response.json() as { csrfToken: string };
    cachedCsrfToken = data.csrfToken;
    return data.csrfToken;
  })();
  try {
    return await csrfRequest;
  } finally {
    csrfRequest = null;
  }
}

export function clearCsrfToken() {
  cachedCsrfToken = null;
  csrfRequest = null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = baseUrl ? new URL(route, baseUrl).toString() : route;

  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  const execute = async (forceToken = false) => {
    const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
    if (isMutation) headers["X-CSRF-Token"] = await getCsrfToken(forceToken);
    return fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  let res = await execute();
  if (isMutation && res.status === 403) res = await execute(true);

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const path = queryKey.join("/") as string;
    const url = baseUrl ? new URL(path, baseUrl).toString() : path;

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
