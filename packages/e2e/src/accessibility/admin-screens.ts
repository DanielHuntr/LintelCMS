import type { Page } from "@playwright/test";
import type { SeededContent } from "../site/seed-site.js";

/**
 * Every screen of the admin, as a signed-in owner sees it on the seeded site, plus the
 * panels and dialogs that open over them. The accessibility sweep visits each one in light
 * and dark; add new screens here as they are built.
 */

export interface AdminScreen {
  name: string;
  path: (content: SeededContent) => string;
  /** What to do once the screen has loaded, such as opening a dialog. */
  open?: (page: Page) => Promise<void>;
}

const at = (path: string) => () => path;

export const adminScreens: AdminScreen[] = [
  { name: "Dashboard", path: at("/") },
  { name: "Content", path: at("/content") },
  { name: "Blog posts", path: at("/content/posts") },
  { name: "Post editor", path: (content) => `/content/posts/${content.posts.draft.id}` },
  { name: "Page editor with blocks", path: (content) => `/content/pages/${content.pages.home.id}` },
  { name: "New entry", path: at("/content/posts/new") },
  { name: "Translation", path: (content) => `/content/pages/${content.pages.aboutInFrench.id}` },
  { name: "Global settings", path: at("/content/globals") },
  { name: "Global set", path: at("/content/globals/site_settings") },
  { name: "Global set fields", path: at("/content/globals/site_settings/fields") },
  { name: "Menus", path: at("/content/navigation") },
  { name: "Menu editor", path: at("/content/navigation/main") },
  { name: "Taxonomies", path: at("/content/taxonomies") },
  { name: "Taxonomy terms", path: at("/content/taxonomies/categories") },
  { name: "Media library", path: at("/media") },
  { name: "Media details", path: (content) => `/media?asset=${content.images.harbour.id}` },
  { name: "Settings", path: at("/settings") },
  { name: "Content types", path: at("/settings/content-types") },
  { name: "New content type", path: at("/settings/content-types/new") },
  { name: "Content type editor", path: at("/settings/content-types/post") },
  { name: "Languages", path: at("/settings/languages") },
  { name: "API access", path: at("/settings/api") },
  { name: "API reference", path: at("/settings/api/reference") },
  { name: "Webhooks", path: at("/settings/webhooks") },
  { name: "Search engines", path: at("/settings/seo") },
  { name: "Redirects", path: at("/settings/seo/redirects") },
  { name: "Help", path: at("/help") },
  { name: "Users (on the roadmap)", path: at("/users") },
  {
    name: "Search palette",
    path: at("/content"),
    open: async (page) => {
      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("dialog", { name: "Search Lintel" }).getByRole("combobox").fill("our");
      await page.getByRole("option").first().waitFor();
    },
  },
  {
    name: "Help panel",
    path: at("/media"),
    open: async (page) => {
      await page.getByRole("button", { name: "Help for this screen" }).click();
      await page.getByRole("button", { name: "Close help" }).waitFor();
    },
  },
  {
    name: "Live preview",
    path: (content) => `/content/posts/${content.posts.published.id}`,
    open: async (page) => {
      await page.getByRole("main").getByRole("button", { name: "Preview" }).click();
      await page.getByRole("complementary", { name: "Preview" }).getByRole("article").waitFor();
    },
  },
  {
    name: "Add a block",
    path: (content) => `/content/pages/${content.pages.home.id}`,
    open: async (page) => {
      await page.getByRole("button", { name: "Add block" }).click();
      await page.getByRole("dialog", { name: "Add a block" }).waitFor();
    },
  },
  {
    name: "Image picker",
    path: (content) => `/content/posts/${content.posts.draft.id}`,
    open: async (page) => {
      await page
        .getByRole("group", { name: "Featured image" })
        .getByRole("button", { name: "Choose image" })
        .click();
      await page
        .getByRole("dialog", { name: "Choose an image" })
        .getByRole("button")
        .first()
        .waitFor();
    },
  },
];
