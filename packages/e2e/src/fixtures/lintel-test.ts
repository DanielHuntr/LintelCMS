import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { accounts, type AccountRole } from "../site/accounts.js";
import { ApiClient } from "../site/api-client.js";
import type { SeededContent } from "../site/seed-site.js";
import { siteTemplates } from "../site/site-templates.js";
import { startSite, type TestSite } from "../site/test-site.js";

/**
 * The `test` every browser test imports. It adds a running Lintel to Playwright's own
 * fixtures and points `page` at it:
 *
 *   test("...", async ({ page, content, api }) => { ... })
 *
 * Which site a test gets is set with `test.use({ site: ... })`:
 *
 *   "seeded"  (default) the seeded site this worker shares with the other tests it runs.
 *             Make your own entries for anything you change.
 *   "private" a seeded site for this test alone, for changes to site-wide settings
 *             (languages, plugins) or ending a session.
 *   "fresh"   a brand new install, with the setup wizard.
 *
 * `signedInAs` ("owner", "editor" or null) picks who the browser is signed in as. It
 * reuses sessions made while seeding, so tests don't spend time (or sign-in attempts,
 * which are rate limited) on the sign-in form. Fresh sites start signed out.
 */

export type SiteKind = "seeded" | "private" | "fresh";

interface TestOptions {
  site: SiteKind;
  signedInAs: AccountRole | null;
}

interface TestFixtures {
  /** The Lintel this test's browser talks to. */
  lintel: TestSite;
  /** What the seeded site starts with: entries, images and sessions, by name. */
  content: SeededContent;
  /** The API as the owner, for preparing content before the browser checks it. */
  api: ApiClient;
  /** The API as the editor. */
  editorApi: ApiClient;
  /** Signs the browser in as someone else part way through a test. */
  signInAs: (role: AccountRole) => Promise<void>;
}

interface WorkerFixtures {
  /** Started the first time a test in this worker asks for the seeded site. */
  sharedSite: () => Promise<TestSite>;
}

export const test = base.extend<TestOptions & TestFixtures, WorkerFixtures>({
  site: ["seeded", { option: true }],
  signedInAs: ["owner", { option: true }],

  sharedSite: [
    async ({}, use) => {
      let started: Promise<TestSite> | undefined;
      await use(() => {
        started ??= siteTemplates().then((templates) => startSite({ template: templates.seeded }));
        return started;
      });
      await (await started)?.stop();
    },
    { scope: "worker", timeout: 60_000 },
  ],

  lintel: async ({ site, sharedSite }, use) => {
    if (site === "seeded") {
      await use(await sharedSite());
      return;
    }
    const templates = await siteTemplates();
    const ownSite = await startSite({
      template: site === "fresh" ? templates.empty : templates.seeded,
    });
    await use(ownSite);
    await ownSite.stop();
  },

  baseURL: async ({ lintel }, use) => use(lintel.url),

  content: async ({}, use) => use((await siteTemplates()).seededContent),

  api: async ({ lintel, content }, use) =>
    use(new ApiClient(lintel.apiUrl, content.sessions.owner)),

  editorApi: async ({ lintel, content }, use) =>
    use(new ApiClient(lintel.apiUrl, content.sessions.editor)),

  signInAs: async ({ context, lintel, content }, use) =>
    use((role) => addSessionCookie(context, lintel.url, content.sessions[role])),

  context: async ({ context, site, signedInAs, lintel, content }, use) => {
    if (signedInAs && site !== "fresh") {
      await addSessionCookie(context, lintel.url, content.sessions[signedInAs]);
    }
    await use(context);
  },
});

export { expect };
export { accounts };
export type { Page };

async function addSessionCookie(
  context: BrowserContext,
  siteUrl: string,
  token: string,
): Promise<void> {
  await context.clearCookies();
  await context.addCookies([
    { name: "lintel_session", value: token, url: siteUrl, httpOnly: true, sameSite: "Lax" },
  ]);
}

/** A title no other test will use, so tests sharing a site can find their own entries. */
export function uniqueTitle(start: string): string {
  return `${start} ${Math.random().toString(36).slice(2, 8)}`;
}
