import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client.js";

/**
 * One cache for the whole admin. Lists stay fresh for half a minute, so moving between
 * screens feels instant without showing anything badly out of date.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying a "not found" or "not allowed" only makes the person wait for the same answer.
        retry: (failureCount, error) => failureCount < 2 && !isClientError(error),
      },
    },
  });
}

function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

/** The admin's cache. Cleared on sign-out, so the next person never sees the last one's data. */
export const adminQueryClient = createQueryClient();
