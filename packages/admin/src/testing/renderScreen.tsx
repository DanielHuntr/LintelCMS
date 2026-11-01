import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { SessionProvider } from "../session/SessionContext.js";

interface RenderScreenOptions {
  /** The signed-in person's permissions. Defaults to everything. */
  permissions?: string[];
  /** The plugins switched on. Defaults to the blog. */
  enabledPlugins?: string[];
  /** The site's name. Defaults to "Brightside Bakery". */
  siteName?: string | null;
  /** The address the screen starts at. Defaults to "/". */
  initialPath?: string;
}

/**
 * Renders one admin screen the way the app does: inside a router (so links work), a fresh
 * query cache (so tests don't share data) and a signed-in session. Every route path leads to
 * the screen, so links inside it can be followed without the whole app's route tree.
 */
export function renderScreen(
  screen: ReactNode,
  {
    permissions = ["*"],
    enabledPlugins = ["blog"],
    siteName = "Brightside Bakery",
    initialPath = "/",
  }: RenderScreenOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session = {
    user: { id: "u1", email: "ada@example.com", name: "Ada Lovelace" },
    permissions,
    enabledPlugins,
    siteName,
  };

  const rootRoute = createRootRoute({
    component: () => <SessionProvider session={session}>{screen}</SessionProvider>,
  });
  const anyPath = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([anyPath]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}
