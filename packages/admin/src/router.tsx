import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { lazy, useCallback } from "react";
import { adminQueryClient } from "./api/queryClient.js";
import { ContentOverviewPage } from "./content/ContentOverviewPage.js";
import type { EntryStatus } from "./content/content.types.js";
import { EntriesListPage } from "./content/EntriesListPage.js";
import type { EntriesFilter } from "./content/entriesQuery.js";
import { BlueprintEditorPage } from "./content-types/BlueprintEditorPage.js";
import { ContentTypesPage } from "./content-types/ContentTypesPage.js";
import { NewContentTypePage } from "./content-types/NewContentTypePage.js";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { AdminLayout } from "./layout/AdminLayout.js";
import { ComingSoonPage } from "./sections/ComingSoonPage.js";
import { fetchCurrentSession, signOut } from "./session/session.api.js";
import { SessionProvider } from "./session/SessionContext.js";
import { SettingsPage } from "./settings/SettingsPage.js";
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
    adminQueryClient.clear();
    await navigate({ to: "/sign-in", search: { redirect: undefined } });
  }

  return (
    <SessionProvider session={session}>
      <AdminLayout
        permissions={session.permissions}
        signedInUser={session.user}
        onSignOut={handleSignOut}
      />
    </SessionProvider>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: DashboardPage,
});

const contentRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/content",
  component: ContentOverviewPage,
});

const entryStatuses: readonly string[] = [
  "draft",
  "published",
  "scheduled",
] satisfies EntryStatus[];

const entriesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/content/$collection",
  // The filter lives in the URL, so a filtered list survives a reload and can be shared.
  validateSearch: (search: Record<string, unknown>): EntriesFilter => ({
    status: entryStatuses.includes(String(search.status))
      ? (search.status as EntryStatus)
      : undefined,
    search: typeof search.search === "string" && search.search !== "" ? search.search : undefined,
    page: typeof search.page === "number" && search.page > 1 ? Math.floor(search.page) : undefined,
  }),
  component: EntriesListRoute,
});

function EntriesListRoute() {
  const { collection } = entriesRoute.useParams();
  const filter = entriesRoute.useSearch();
  const navigate = entriesRoute.useNavigate();
  const changeFilter = useCallback(
    (next: EntriesFilter) =>
      void navigate({
        search: { ...next, page: next.page === 1 ? undefined : next.page },
        replace: true,
      }),
    [navigate],
  );

  return (
    <EntriesListPage collectionHandle={collection} filter={filter} onFilterChange={changeFilter} />
  );
}

// The editor brings the rich text editor with it, so it loads only when someone opens an entry.
const EntryEditorPage = lazy(async () => ({
  default: (await import("./content/EntryEditorPage.js")).EntryEditorPage,
}));

// "/content/posts/new" is this route too, with entryId "new": see EntryEditorPage for why.
const entryEditorRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/content/$collection/$entryId",
  component: function EntryEditorRoute() {
    const { collection, entryId } = entryEditorRoute.useParams();
    return <EntryEditorPage collectionHandle={collection} entryId={entryId} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings",
  component: SettingsPage,
});

const contentTypesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/content-types",
  component: ContentTypesPage,
});

const newContentTypeRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/content-types/new",
  component: NewContentTypePage,
});

const blueprintRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/content-types/$handle",
  component: function BlueprintRoute() {
    const { handle } = blueprintRoute.useParams();
    return <BlueprintEditorPage handle={handle} />;
  },
});

const contentRoutes = [
  contentRoute,
  entriesRoute,
  entryEditorRoute,
  settingsRoute,
  contentTypesRoute,
  newContentTypeRoute,
  blueprintRoute,
];

// One placeholder route per section. Each is replaced by real screens as its phase is built.
const sectionRoutes = [
  { path: "/design", title: "nav.design" },
  { path: "/commerce", title: "nav.commerce" },
  { path: "/media", title: "nav.media" },
  { path: "/forms", title: "nav.forms" },
  { path: "/users", title: "nav.users" },
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

const routeTree = rootRoute.addChildren([
  signInRoute,
  ...designReviewRoutes,
  adminRoute.addChildren([dashboardRoute, ...contentRoutes, ...placeholderRoutes]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
