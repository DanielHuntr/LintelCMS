import { QueryClient } from "@tanstack/react-query";

/**
 * The cache for data loaded from the API, shared by every screen. Data counts as fresh for
 * 30 seconds, so moving between screens doesn't refetch everything, and failed requests
 * retry once (a second failure is usually real, and the screen should say so).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  });
}

export const queryClient = createQueryClient();
