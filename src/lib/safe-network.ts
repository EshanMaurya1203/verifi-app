/**
 * Reusable Network and Database Reliability Helpers
 * Ensures zero uncaught promise rejections, zero failed request crashes,
 * and graceful data recovery structures.
 */

export interface SafeNetworkResponse<T> {
  data: T | null;
  error: Error | null;
  ok: boolean;
  status?: number;
}

interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Perform a fetch operation with timeout, status checking, automatic JSON/Text parsing,
 * and optional retries for transient network errors.
 * Wrapped in a global safety net to guarantee it never throws an uncaught exception.
 */
export async function safeFetch<T>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeNetworkResponse<T>> {
  const { timeoutMs = 8000, retries = 1, retryDelay = 1000, ...fetchOptions } = options;
  
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt <= retries) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(id);

      let data: any = null;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (parseError: any) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[safeFetch] Failed to parse JSON response from ${url}:`, parseError);
          }
        }
      } else {
        try {
          const text = await response.text();
          data = text ? { message: text } : null;
        } catch (textError) {
          // Fallback silently if response body can't be read
        }
      }

      if (!response.ok) {
        const errorMsg = typeof data?.error === 'string' ? data.error : (data?.error?.message || data?.error?.description || data?.message || `HTTP error! status: ${response.status}`);
        const httpError = new Error(errorMsg);
        
        // Don't retry on 4xx client errors (except 429 Too Many Requests)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return { data: null, error: httpError, ok: false, status: response.status };
        }
        
        throw httpError;
      }

      return {
        data: data as T,
        error: null,
        ok: true,
        status: response.status,
      };
    } catch (error: any) {
      clearTimeout(id);
      
      let finalError = error;
      if (error.name === "AbortError") {
        finalError = new Error(`Request timed out after ${timeoutMs}ms`);
      }
      lastError = finalError;
      
      if (attempt <= retries) {
        if (process.env.NODE_ENV === "development") {
           console.warn(`[safeFetch] Attempt ${attempt} failed for ${url}. Retrying in ${retryDelay}ms...`);
        }
        await new Promise(res => setTimeout(res, retryDelay));
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[safeFetch] Network request to ${url} failed after ${retries + 1} attempts:`, lastError?.message || lastError);
  }

  return {
    data: null,
    error: lastError,
    ok: false,
  };
}

/**
 * Safely execute a Supabase database query promise, handling PostgrestError structures
 * and standard network connection issues cleanly.
 */
export async function safeSupabaseQuery<T>(
  queryPromise: any
): Promise<SafeNetworkResponse<T>> {
  try {
    const { data, error } = await queryPromise;

    if (error) {
      const dbError = new Error(error.message || JSON.stringify(error));
      if (process.env.NODE_ENV === "development") {
        console.warn("[safeSupabaseQuery] Supabase query returned an error:", error);
      }
      return {
        data: null,
        error: dbError,
        ok: false,
      };
    }

    return {
      data,
      error: null,
      ok: true,
    };
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[safeSupabaseQuery] Supabase operation crashed:", error.message || error);
    }
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
      ok: false,
    };
  }
}
