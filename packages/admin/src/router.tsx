import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { AdminLayout } from "./layout/AdminLayout.js";
import { ComingSoonPage } from "./sections/ComingSoonPage.js";
import { SignInPage } from "./sign-in/SignInPage.js";

// Until sign-in exists, the admin behaves as a super admin so every section is visible.
const temporaryPermissions = ["*"];

const rootRoute = createRootRoute();

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  component: () => <AdminLayout permissions={temporaryPermissions} />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: DashboardPage,
});

// One placeholder route per section. Each is replaced by real screens as its phase is built.
const sectionRoutes = [
  { path: "/content", title: "nav.content" },
  { path: "/design", title: "nav.design" },
  { path: "/commerce", title: "nav.commerce" },
  { path: "/media", title: "nav.media" },
  { path: "/forms", title: "nav.forms" },
  { path: "/users", title: "nav.users" },
  { path: "/settings", title: "nav.settings" },
  { path: "/help", title: "nav.help" },
] as const;

const placeholderRoutes = sectionRoutes.map(({ path, title }) =>
  createRoute({
    getParentRoute: () => adminRoute,
    path,
    component: () => <ComingSoonPage title={title} />,
  }),
);

const routeTree = rootRoute.addChildren([
  signInRoute,
  adminRoute.addChildren([dashboardRoute, ...placeholderRoutes]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
