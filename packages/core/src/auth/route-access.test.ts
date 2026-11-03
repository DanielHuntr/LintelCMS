import { randomUUID } from "node:crypto";
import type { FastifyInstance, HTTPMethods } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { buildServer } from "../server.js";
import { writeSetting } from "../settings/settings.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * Every route the server registers must be one of:
 *
 *   - public by design, listed below with the reason;
 *   - published content, open unless Build → API access asks for a token;
 *   - for anyone signed in, listed below;
 *   - guarded by a permission (everything else).
 *
 * The test finds the routes itself, so a new route that forgets its guard fails here
 * instead of quietly being open to the internet.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  "GET /health": "load balancers check it",
  "GET /ready": "hosting platforms check the database is reachable",
  "POST /auth/sign-in": "how people get a session",
  "POST /auth/sign-out": "ends whatever session the browser has, if any",
  "GET /setup/status": "the admin asks it before anyone has an account",
  "POST /setup/database/test": "first run only, needs the setup code from another computer",
  "POST /setup/finish": "first run only, needs the setup code from another computer",
  "GET /preview": "needs a signed preview token",
  "GET /media/:id/file": "image URLs go straight into websites' <img> tags",
  "GET /openapi.json": "describes the public API",
  "GET /sitemap.xml": "for search engines",
  "GET /robots.txt": "for search engines",
  "POST /auth/sign-in/two-factor": "the second sign-in step, needs the challenge from the first",
  "POST /auth/passkey/options": "starts a passkey sign-in, gives out only a challenge",
  "POST /auth/passkey/sign-in": "signing in, needs a passkey's signed answer",
  "POST /auth/forgot-password": "how someone who can't sign in asks for a reset link",
  "POST /auth/reset-password/check": "needs the emailed reset link's token",
  "POST /auth/reset-password": "needs the emailed reset link's token",
  "POST /invitations/preview": "needs the emailed invitation's token",
  "POST /invitations/accept": "needs the emailed invitation's token",
  "POST /account/email/confirm": "needs the link emailed to the new address",
  "GET /branding": "the sign-in screen is shown in the site's branding",
  "GET /branding/images/:field": "the logo and background the sign-in screen shows",
  "GET /interface-language": "the language the sign-in screen is shown in",
  "GET /addons/admin-scripts": "the admin loads add-ons' screens before anyone signs in",
  "GET /addons/:id/admin.js": "an add-on's admin code, public like the admin's own",
  "GET /addons/:id/admin.css": "an add-on's admin styles, public like the admin's own",
  "POST /shop/stripe/webhook": "Stripe's payment events, checked by their signature",
  "POST /shop/paypal/webhook": "PayPal's payment events, checked with PayPal",
  "POST /shop/mollie/webhook": "Mollie's payment events, looked up with Mollie",
};

const SIGNED_IN_ROUTES = new Set([
  "GET /auth/me",
  "GET /search",
  "GET /locales",
  "GET /seo/defaults",
  // The site's address, for "View page" in the editor.
  "GET /website/address",
  // Whether emails really go out, so screens can warn when they won't (no settings shown).
  "GET /email/status",
  // Each person's own account and its security.
  "GET /account",
  "PATCH /account",
  "POST /account/email",
  "POST /account/password",
  "GET /account/sessions",
  "DELETE /account/sessions/:id",
  "POST /account/sessions/sign-out-others",
  "GET /account/two-factor",
  "POST /account/two-factor/setup",
  "POST /account/two-factor/confirm",
  "POST /account/two-factor/disable",
  "POST /account/two-factor/recovery-codes",
  "GET /account/passkeys",
  "POST /account/passkeys/options",
  "POST /account/passkeys",
  "DELETE /account/passkeys/:id",
  // Each person's own approvals to answer (only reviewers in the step's role may) and notifications.
  "GET /workflow-approvals",
  "POST /workflow-approvals/:approvalId/decision",
  "GET /notifications",
  "POST /notifications/read-all",
  "POST /notifications/:notificationId/read",
  // Each person's own admin language.
  "PUT /interface-language",
  // The sites someone may work on, for the admin's site switcher.
  "GET /sites",
  // Lintel's version for Help, and whether an update is restarting it, for the admin's banner.
  "GET /about",
  "GET /updates/status",
  // Each person's own dashboard layout.
  "GET /dashboard/layout",
  "PUT /dashboard/layout",
  "DELETE /dashboard/layout",
  // Installed apps' pages, widgets and panels, and a session token for the person looking
  // at one (each frame cuts the app's access down to what that person may do).
  "GET /apps/extensions",
  "POST /apps/:id/session-token",
]);

/**
 * Delivery routes that stay open even when delivery needs a token: a form on a public
 * website can't keep a token secret (see src/forms), and nor can its visitor beacon
 * (see src/analytics).
 */
const ALWAYS_OPEN_DELIVERY_ROUTES = new Set([
  "GET /delivery/analytics/script.js",
  "POST /delivery/analytics/collect",
  "GET /delivery/forms.js",
  "GET /delivery/forms/:handle",
  "POST /delivery/forms/:handle/submissions",
]);

/** Published content: open by default, a token or session once delivery requires one. */
function isDeliveryRoute(route: string): boolean {
  const [, path = ""] = route.split(" ");
  return path === "/graphql" || path.startsWith("/delivery/");
}

/** Placeholder values for path parameters, so the request reaches the route's guard. */
function fillPath(path: string): string {
  return path.replace(/:([A-Za-z]+)/g, (_match, name: string) =>
    name.toLowerCase().endsWith("id") ? randomUUID() : "test_value",
  );
}

// Each test sends a request to every route, which takes a while.
const SLOW_TEST_TIMEOUT = 60_000;

describe("access to every route", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  const routes: string[] = [];
  let withoutPermissions: Record<string, string>;

  beforeAll(async () => {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
    });
    server.addHook("onRoute", (route) => {
      const methods = ([] as HTTPMethods[]).concat(route.method);
      for (const method of methods) {
        // HEAD copies of GET routes and CORS preflights have no handler of their own.
        if (method !== "HEAD" && method !== "OPTIONS") {
          routes.push(`${method} ${route.url}`);
        }
      }
    });
    await server.ready();
  });

  afterAll(() => server.close());

  // useTestDatabase empties the database before each test, so each test sets up its own.
  async function prepare() {
    // Every plugin on, so their routes reach their own guards.
    await setEnabledPlugins(testDatabase.database, server.plugins, server.plugins.ids);
    await createTestUser(testDatabase.database, "nobody@example.com", [[]]);
    withoutPermissions = await signInAndGetCookies(server, "nobody@example.com");
  }

  function send(route: string, cookies?: Record<string, string>) {
    const [method, path = ""] = route.split(" ") as [HTTPMethods, string];
    return server.inject({
      method,
      url: fillPath(path),
      ...(cookies ? { cookies } : {}),
      ...(method === "GET" || method === "DELETE" ? {} : { payload: {} }),
    });
  }

  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(80);
    for (const route of [...Object.keys(PUBLIC_ROUTES), ...SIGNED_IN_ROUTES]) {
      expect(routes, `${route} is listed here but no longer exists`).toContain(route);
    }
  });

  it(
    "asks for a session (or token) on every route that isn't public",
    async () => {
      await prepare();
      const open: string[] = [];
      for (const route of routes) {
        if (route in PUBLIC_ROUTES || isDeliveryRoute(route)) {
          continue;
        }
        const response = await send(route);
        if (response.statusCode !== 401) {
          open.push(`${route} answered ${response.statusCode} without a session`);
        }
      }
      expect(open).toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "asks for a permission on every route that isn't for anyone signed in",
    async () => {
      await prepare();
      const unguarded: string[] = [];
      for (const route of routes) {
        if (route in PUBLIC_ROUTES || isDeliveryRoute(route)) {
          continue;
        }
        const response = await send(route, withoutPermissions);
        const refused = response.statusCode === 403;
        if (SIGNED_IN_ROUTES.has(route) ? refused || response.statusCode === 401 : !refused) {
          unguarded.push(`${route} answered ${response.statusCode} to someone with no permissions`);
        }
      }
      expect(unguarded).toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "keeps all published content behind a token once delivery requires one",
    async () => {
      await prepare();
      await writeSetting(testDatabase.database, "deliveryRequiresToken", true);
      const open: string[] = [];
      const tokenRoutes = routes.filter(
        (route) => isDeliveryRoute(route) && !ALWAYS_OPEN_DELIVERY_ROUTES.has(route),
      );
      for (const route of tokenRoutes) {
        const response = await send(route);
        if (response.statusCode !== 401) {
          open.push(`${route} answered ${response.statusCode} without a token`);
        }
      }
      expect(open).toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "closes the first-run endpoints once someone has an account",
    async () => {
      await prepare();
      for (const route of ["POST /setup/finish", "POST /setup/database/test"]) {
        const response = await send(route);
        expect(response.statusCode, route).toBe(409);
      }
    },
    SLOW_TEST_TIMEOUT,
  );
});
