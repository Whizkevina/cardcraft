import { QueryClient, QueryFunction } from "@tanstack/react-query";

// In development, point to Express backend on port 5000
// In production, use relative URLs (same domain)
const API_BASE = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:5000";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[apiRequest] ${method} ${fullUrl}`, data ? `with data: ${JSON.stringify(data).slice(0, 50)}...` : "");
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
    });

    console.log(`[apiRequest] Response status: ${res.status} ${res.statusText}`);
    await throwIfResNotOk(res);
    return res;
  } catch (err) {
    console.error(`[apiRequest] Error on ${method} ${fullUrl}:`, err);
    throw err;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`);

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
