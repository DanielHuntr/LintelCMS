import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { lazy, useCallback } from "react";
import { ApiAccessPage } from "./api-access/ApiAccessPage.js";
import { ApiReferencePage } from "./api-access/ApiReferencePage.js";
import { adminQueryClient } from "./api/queryClient.js";
import { ContentOverviewPage } from "./content/ContentOverviewPage.js";
import type { EntryStatus } from "./content/content.types.js";
import { EntriesListPage } from "./content/EntriesListPage.js";
import type { EntriesFilter } from "./content/entriesQuery.js";
import { BlueprintEditorPage } from "./content-types/BlueprintEditorPage.js";
import { contentModelRoutes } from "./content-model/contentModelRoutes.js";
import { ContentTypesPage } from "./content-types/ContentTypesPage.js";
import { NewContentTypePage } from "./content-types/NewContentTypePage.js";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { HelpPage } from "./help/HelpPage.js";
import { BrandingPage } from "./branding/BrandingPage.js";
import { InterfaceLanguagePage } from "./interface-language/InterfaceLanguagePage.js";
import { loadInterfaceLanguage } from "./interface-language/loadInterfaceLanguage.js";
import { AdminLayout } from "./layout/AdminLayout.js";
import { MediaLibraryPage } from "./media/MediaLibraryPage.js";
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
import { SessionProvider } from "./session/SessionContext.js";
import { RedirectsPage } from "./seo/RedirectsPage.js";
import { SeoSettingsPage } from "./seo/SeoSettingsPage.js";
import { SettingsPage } from "./settings/SettingsPage.js";
import { SignInPage } from "./sign-in/SignInPage.js";
import { WebhookDetailPage } from "./webhooks/WebhookDetailPage.js";
import { WebhooksPage } from "./webhooks/WebhooksPage.js";
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
    adminQueryClient.clear();
    // The next person may have chosen another language; until then, the site's.
    await loadInterfaceLanguage();
    await navigate({ to: "/sign-in", search: { redirect: undefined } });
  }

  return (
    <SessionProvider session={session}>
      <AdminLayout
        permissions={session.permissions}
        enabledPlugins={session.enabledPlugins}
        signedInUser={session.user}
        onSignOut={handleSignOut}
      />
    </SessionProvider>
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
    locale: typeof search.locale === "string" && search.locale !== "" ? search.locale : undefined,
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
  // A new entry can be started in another language: /content/pages/new?locale=fr-FR.
  validateSearch: (search: Record<string, unknown>): { locale?: string } => ({
    locale: typeof search.locale === "string" && search.locale !== "" ? search.locale : undefined,
  }),
  component: function EntryEditorRoute() {
    const { collection, entryId } = entryEditorRoute.useParams();
    const { locale } = entryEditorRoute.useSearch();
    return <EntryEditorPage collectionHandle={collection} entryId={entryId} locale={locale} />;
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

const apiAccessRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/api",
  component: ApiAccessPage,
});

const apiReferenceRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/api/reference",
  component: ApiReferencePage,
});

const webhooksRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/webhooks",
  component: WebhooksPage,
});

const webhookRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/webhooks/$webhookId",
  component: function WebhookRoute() {
    const { webhookId } = webhookRoute.useParams();
    return <WebhookDetailPage webhookId={webhookId} />;
  },
});

const seoSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/seo",
  component: SeoSettingsPage,
});

const redirectsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/seo/redirects",
  component: RedirectsPage,
});

const brandingRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/branding",
  component: BrandingPage,
});

const interfaceLanguageRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/interface-language",
  component: InterfaceLanguagePage,
});

/** API access, webhooks and the SEO plugin's settings. */
const integrationRoutes = [
  apiAccessRoute,
  apiReferenceRoute,
  webhooksRoute,
  webhookRoute,
  seoSettingsRoute,
  redirectsRoute,
];

const contentRoutes = [
  contentRoute,
  ...contentModelRoutes(() => adminRoute),
  entriesRoute,
  entryEditorRoute,
  settingsRoute,
  contentTypesRoute,
  newContentTypeRoute,
  blueprintRoute,
  brandingRoute,
  interfaceLanguageRoute,
];

// One placeholder route per section. Each is replaced by real screens as its phase is built.
const sectionRoutes = [
  { path: "/design", title: "nav.design" },
  { path: "/commerce", title: "nav.commerce" },
  { path: "/forms", title: "nav.forms" },
  { path: "/users", title: "nav.users" },
] as const;

/** Help: the "Using Lintel" docs, bundled with the admin. The open topic is in the address. */
const helpRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/help",
  validateSearch: (search: Record<string, unknown>): { topic?: string; anchor?: string } => ({
    topic: typeof search.topic === "string" && search.topic !== "" ? search.topic : undefined,
    anchor: typeof search.anchor === "string" && search.anchor !== "" ? search.anchor : undefined,
  }),
  component: function HelpRoute() {
    const { topic, anchor } = helpRoute.useSearch();
    const navigate = helpRoute.useNavigate();
    return (
      <HelpPage
        topic={topic}
        anchor={anchor}
        onOpenTopic={(nextTopic, nextAnchor) =>
          void navigate({ search: { topic: nextTopic, anchor: nextAnchor } })
        }
      />
    );
  },
});

const mediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/media",
  // `?asset=` opens one file's details, as search does when a file is picked; `?search=`
  // fills in the library's search, so that file is in the list however old it is.
  validateSearch: (search: Record<string, unknown>): { asset?: string; search?: string } => ({
    asset: typeof search.asset === "string" && search.asset !== "" ? search.asset : undefined,
    search: typeof search.search === "string" && search.search !== "" ? search.search : undefined,
  }),
  component: function MediaRoute() {
    const { session } = adminRoute.useRouteContext();
    const { asset, search } = mediaRoute.useSearch();
    return (
      <MediaLibraryPage
        key={asset}
        permissions={session.permissions}
        initialAssetId={asset}
        initialSearch={search}
      />
    );
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

/** Exported so tests can run the real routes in memory, without a browser. */
export const routeTree = rootRoute.addChildren([
  setupGateRoute.addChildren([
    setupRoute,
    siteSetupRoute,
    signInRoute,
    adminRoute.addChildren([
      dashboardRoute,
      mediaRoute,
      helpRoute,
      ...contentRoutes,
      ...integrationRoutes,
      ...placeholderRoutes,
    ]),
  ]),
  ...designReviewRoutes,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
