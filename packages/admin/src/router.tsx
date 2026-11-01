import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { AdminLayout } from "./layout/AdminLayout.js";
import { MediaLibraryPage } from "./media/MediaLibraryPage.js";
import { ComingSoonPage } from "./sections/ComingSoonPage.js";
import { fetchCurrentSession, signOut } from "./session/session.api.js";
import { SignInPage } from "./sign-in/SignInPage.js";

const rootRoute = createRootRoute();

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  // `redirect` remembers where the person was going before they were asked to sign in.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignInPage,
});

/**
 * Every admin screen sits under this route. Before any of them loads, it asks the API
 * who is signed in; nobody signed in means a trip to the sign-in screen.
 */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  beforeLoad: async ({ location }) => {
    const session = await fetchCurrentSession();

    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }

    return { session };
  },
  component: SignedInAdmin,
});

function SignedInAdmin() {
  const { session } = adminRoute.useRouteContext();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    await navigate({ to: "/sign-in", search: { redirect: undefined } });
  }

  return (
    <AdminLayout
      permissions={session.permissions}
      signedInUser={session.user}
      onSignOut={handleSignOut}
    />
  );
}

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
  { path: "/forms", title: "nav.forms" },
  { path: "/users", title: "nav.users" },
  { path: "/settings", title: "nav.settings" },
  { path: "/help", title: "nav.help" },
] as const;

const mediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/media",
  component: function MediaRoute() {
    const { session } = adminRoute.useRouteContext();
    return <MediaLibraryPage permissions={session.permissions} />;
  },
});

const placeholderRoutes = sectionRoutes.map(({ path, title }) =>
  createRoute({
    getParentRoute: () => adminRoute,
    path,
    component: () => <ComingSoonPage title={title} />,
  }),
);

// The design review page exists in development, or in a build made with VITE_DESIGN_REVIEW=true.
// It is loaded lazily, so a normal production build doesn't ship it.
const showsDesignReview = import.meta.env.DEV || import.meta.env.VITE_DESIGN_REVIEW === "true";

const designReviewRoutes = showsDesignReview
  ? [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/design-system",
        component: lazyRouteComponent(
          () => import("./design-review/DesignReviewPage.js"),
          "DesignReviewPage",
        ),
      }),
    ]
  : [];

const routeTree = rootRoute.addChildren([
  signInRoute,
  ...designReviewRoutes,
  adminRoute.addChildren([dashboardRoute, mediaRoute, ...placeholderRoutes]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
