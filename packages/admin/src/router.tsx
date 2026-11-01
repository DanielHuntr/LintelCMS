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
import { commerceRoutes } from "./commerce/commerceRoutes.js";
import { contentModelRoutes } from "./content-model/contentModelRoutes.js";
import { ContentTypesPage } from "./content-types/ContentTypesPage.js";
import { NewContentTypePage } from "./content-types/NewContentTypePage.js";
import { pageDesignRoutes } from "./page-design/pageDesignRoutes.js";
import { DashboardPage } from "./dashboard/DashboardPage.js";
import { formsRoutes } from "./forms/formsRoutes.js";
import { PluginScreenRoute } from "./plugins/PluginScreenRoute.js";
import { SectionTabs } from "./plugins/SectionTabs.js";
import { HelpPage } from "./help/HelpPage.js";
import { peopleRoutes, signedOutAccountRoutes } from "./people/peopleRoutes.js";
import { BrandingPage } from "./branding/BrandingPage.js";
import { InterfaceLanguagePage } from "./interface-language/InterfaceLanguagePage.js";
import { loadInterfaceLanguage } from "./interface-language/loadInterfaceLanguage.js";
import { AdminLayout } from "./layout/AdminLayout.js";
import { MediaLibraryPage } from "./media/MediaLibraryPage.js";
import { ComingSoonPage } from "./sections/ComingSoonPage.js";
import { fetchCurrentSession, signOut } from "./session/session.api.js";
import { ServerUnreachablePage } from "./setup/ServerUnreachablePage.js";
import { SetupPage } from "./setup/SetupPage.js";
import {
  checkSetupStatus,
  destinationOnceSetUp,
  mustFinishSetupFirst,
} from "./setup/setupRouting.js";
import { SessionProvider } from "./session/SessionContext.js";
import { loadSitesForAdmin } from "./sites/loadSitesForAdmin.js";
import { CurrentSiteProvider } from "./sites/SiteContext.js";
import { SitesPage } from "./sites/SitesPage.js";
import { SettingsPage } from "./settings/SettingsPage.js";
import { PublishedPageView } from "./content/PublishedPageView.js";
import { FeaturesSettingsPage } from "./features/FeaturesSettingsPage.js";
import { SignInPage } from "./sign-in/SignInPage.js";
import { WebhookDetailPage } from "./webhooks/WebhookDetailPage.js";
import { SiteSettingsPage } from "./website/SiteSettingsPage.js";
import { WebhooksPage } from "./webhooks/WebhooksPage.js";
import { runtimeSettings } from "./runtime-settings.js";
import { workflowsRoutes } from "./workflows/workflowsRoutes.js";
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
    const destination = destinationOnceSetUp(session !== null);

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
 * who is signed in; nobody signed in means a trip to the sign-in screen.
 */
const adminRoute = createRoute({
  getParentRoute: () => setupGateRoute,
  id: "admin",
  beforeLoad: async ({ location }) => {
    const session = await fetchCurrentSession();

    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    // Their role requires two-factor authentication: the account page is where to turn it on.
    if (session.mustSetUpTwoFactor && location.pathname !== "/account") {
      throw redirect({ to: "/account" });
    }

    // Settles which site requests are for before any screen asks for content.
    const sites = await loadSitesForAdmin(adminQueryClient);
    return { session, sites };
  },
  errorComponent: ServerUnreachablePage,
  component: SignedInAdmin,
});

function SignedInAdmin() {
  const { session, sites } = adminRoute.useRouteContext();
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
      <CurrentSiteProvider initialSites={sites}>
        <AdminLayout
          permissions={session.permissions}
          enabledPlugins={session.enabledPlugins}
          siteName={session.siteName}
          signedInUser={session.user}
          onSignOut={handleSignOut}
        />
      </CurrentSiteProvider>
    </SessionProvider>
  );
}

const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: function Dashboard() {
    return (
      <SectionTabs section="/">
        <DashboardPage />
      </SectionTabs>
    );
  },
});

const contentRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/content",
  component: function ContentOverview() {
    return (
      <SectionTabs section="/content">
        <ContentOverviewPage />
      </SectionTabs>
    );
  },
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

// "View page" for a published entry when no website is connected yet (see content/viewPage.ts).
const publishedPageRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/content/$collection/$entryId/view",
  component: function PublishedPageRoute() {
    const { collection, entryId } = publishedPageRoute.useParams();
    return <PublishedPageView collectionHandle={collection} entryId={entryId} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings",
  component: SettingsPage,
});

const sitesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/sites",
  component: SitesPage,
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

const siteSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/site",
  component: SiteSettingsPage,
});

/** Settings → Features: switching plugins on and off. */
const featuresRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings/features",
  component: FeaturesSettingsPage,
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

/** API access, webhooks and the website. (The SEO plugin's settings are plugin screens.) */
const integrationRoutes = [
  siteSettingsRoute,
  apiAccessRoute,
  apiReferenceRoute,
  webhooksRoute,
  webhookRoute,
];

/**
 * Any other address: a plugin's screen, or "page not found" (see PluginScreenRoute). Kept
 * last in TanStack Router's ranking, so it never hides one of the admin's own routes.
 */
const pluginScreensRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "$",
  component: PluginScreenRoute,
});

const contentRoutes = [
  contentRoute,
  ...contentModelRoutes(() => adminRoute),
  entriesRoute,
  entryEditorRoute,
  publishedPageRoute,
  settingsRoute,
  sitesRoute,
  contentTypesRoute,
  newContentTypeRoute,
  blueprintRoute,
  brandingRoute,
  interfaceLanguageRoute,
];

// One placeholder route per section. Each is replaced by real screens as its phase is built.
const sectionRoutes = [{ path: "/design", title: "nav.design" }] as const;

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
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/design-system/motion",
        component: lazyRouteComponent(
          () => import("./design-review/motion/MotionReviewPage.js"),
          "MotionReviewPage",
        ),
      }),
    ]
  : [];

/** Exported so tests can run the real routes in memory, without a browser. */
export const routeTree = rootRoute.addChildren([
  setupGateRoute.addChildren([
    setupRoute,
    signInRoute,
    ...signedOutAccountRoutes(() => setupGateRoute),
    ...pageDesignRoutes(() => setupGateRoute),
    adminRoute.addChildren([
      dashboardRoute,
      mediaRoute,
      helpRoute,
      ...contentRoutes,
      ...integrationRoutes,
      featuresRoute,
      ...peopleRoutes(() => adminRoute),
      ...workflowsRoutes(() => adminRoute),
      ...formsRoutes(() => adminRoute),
      ...commerceRoutes(() => adminRoute),
      ...placeholderRoutes,
      pluginScreensRoute,
    ]),
  ]),
  ...designReviewRoutes,
]);

// In production the admin lives under ADMIN_PATH, /admin by default (see runtime-settings.ts).
export const router = createRouter({ routeTree, basepath: runtimeSettings.basePath });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
