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
import { ComingSoonPage } from "./sections/ComingSoonPage.js";
import { fetchCurrentSession, signOut } from "./session/session.api.js";
import { ServerUnreachablePage } from "./setup/ServerUnreachablePage.js";
import { fetchPlugins } from "./setup/setup.api.js";
import { SetupPage } from "./setup/SetupPage.js";
import {
  checkSetupStatus,
  destinationOnceSetUp,
  mustChooseSiteFirst,
  mustFinishSetupFirst,
} from "./setup/setupRouting.js";
import { SiteSetupPage } from "./setup/SiteSetupPage.js";
import { SignInPage } from "./sign-in/SignInPage.js";
import "./setup/historyState.js";

const rootRoute = createRootRoute();

/**
 * Sign-in, setup and every admin screen sit under this gate. A brand new Lintel has no
 * account yet, so until one exists every address leads to /setup. src/setup/README.md has
 * the whole picture.
 */
const setupGateRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "setup-gate",
  beforeLoad: async ({ location }) => {
    const setupStatus = await checkSetupStatus();

    if (mustFinishSetupFirst(location.pathname, setupStatus.needsSetup)) {
      throw redirect({ to: "/setup" });
    }

    return { setupStatus };
  },
  errorComponent: ServerUnreachablePage,
});

const setupRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/setup",
  // Once the account exists there is nothing to set up here, so send people on.
  beforeLoad: async ({ context }) => {
    if (context.setupStatus.needsSetup) return;

    const session = await fetchCurrentSession();
    const destination = destinationOnceSetUp(
      session !== null,
      context.setupStatus.siteSetupCompleted,
    );

    throw destination === "/sign-in"
      ? redirect({ to: "/sign-in", search: { redirect: undefined } })
      : redirect({ to: destination });
  },
  errorComponent: ServerUnreachablePage,
  component: function SetupScreen() {
    const { setupStatus } = setupRoute.useRouteContext();
    return <SetupPage status={setupStatus} />;
  },
});

/** "What are you building?": the last step, for someone signed in who hasn't answered it. */
const siteSetupRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/setup/site",
  beforeLoad: async ({ context, location }) => {
    const session = await fetchCurrentSession();

    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (context.setupStatus.siteSetupCompleted) {
      throw redirect({ to: "/" });
    }

    return { session };
  },
  loader: async () => ({ plugins: await fetchPlugins() }),
  errorComponent: ServerUnreachablePage,
  component: function SiteSetupScreen() {
    const { setupStatus, session } = siteSetupRoute.useRouteContext();
    const { plugins } = siteSetupRoute.useLoaderData();
    return <SiteSetupPage status={setupStatus} session={session} plugins={plugins} />;
  },
});

const signInRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  path: "/sign-in",
  // `redirect` remembers where the person was going before they were asked to sign in.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignInPage,
});

/**
 * Every admin screen sits under this route. Before any of them loads, it asks the API
 * who is signed in; nobody signed in means a trip to the sign-in screen. Someone signed in
 * who hasn't finished "What are you building?" goes back to it first.
 */
const adminRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  id: "admin",
  beforeLoad: async ({ context, location }) => {
    const session = await fetchCurrentSession();

    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (mustChooseSiteFirst(context.setupStatus)) {
      throw redirect({ to: "/setup/site" });
    }

    return { session };
  },
  errorComponent: ServerUnreachablePage,
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
      enabledPlugins={session.enabledPlugins}
      signedInUser={session.user}
      onSignOut={handleSignOut}
    />
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: function Dashboard() {
    const { session } = adminRoute.useRouteContext();
    return <DashboardPage showSales={session.enabledPlugins.includes("commerce")} />;
  },
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

/** Exported so tests can run the real routes in memory, without a browser. */
export const routeTree = rootRoute.addChildren([
  setupGateRoute.addChildren([
    setupRoute,
    siteSetupRoute,
    signInRoute,
    adminRoute.addChildren([dashboardRoute, ...placeholderRoutes]),
  ]),
  ...designReviewRoutes,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
