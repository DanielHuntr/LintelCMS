import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  type ActiveDatabase,
  type Asset,
  type EntryResponse,
  rolesTable,
  userRolesTable,
  usersTable,
} from "@lintel/core";
import { accounts, type AccountRole } from "./accounts.js";
import { ApiClient } from "./api-client.js";

/**
 * The content a "seeded site" starts with: a small blog in two languages, written through
 * the API the admin uses, so it is shaped exactly like content people make.
 *
 * Tests read `SeededContent` to find things by name. They should still make their own
 * entries for anything they change, so tests sharing a site don't see each other's edits.
 */

export interface SeededContent {
  /** A signed-in session for each account, already in the database. */
  sessions: Record<AccountRole, string>;
  posts: { published: SeededEntry; secondPublished: SeededEntry; draft: SeededEntry };
  pages: { home: SeededEntry; about: SeededEntry; aboutInFrench: SeededEntry };
  images: { harbour: SeededAsset; team: SeededAsset };
}

export interface SeededEntry {
  id: string;
  title: string;
  slug: string;
}

export interface SeededAsset {
  id: string;
  filename: string;
}

export const sampleFile = (name: string) =>
  fileURLToPath(new URL(`../sample-files/${name}`, import.meta.url));

/** The permissions a client editor gets: write and publish content and media, nothing else. */
export const EDITOR_PERMISSIONS = [
  "entries:*",
  "media:*",
  "collections:read",
  "blueprints:read",
  "taxonomies:read",
  "terms:update",
  "navigation:read",
  "globals:read",
  "globals:update",
];

export async function seedSite(apiUrl: string, database: ActiveDatabase): Promise<SeededContent> {
  const owner = new ApiClient(apiUrl);
  await owner.post("/setup/database", { kind: "built-in" });
  await owner.post("/setup", accounts.owner);
  await owner.post("/setup/site", { siteType: "blog", plugins: ["blog", "seo"] });
  await addEditor(database);

  const images = {
    harbour: await uploadImage(owner, "harbour.jpg", "image/jpeg", "Boats moored in the harbour"),
    team: await uploadImage(owner, "team.png", "image/png", ""),
  };

  await owner.post("/locales", { code: "fr-FR" });
  const posts = await seedPosts(owner, images.harbour.id);
  const pages = await seedPages(owner, images.team.id);
  await seedMenu(owner, pages);
  await owner.patch("/globals/site_settings/values", {
    data: { site_name: "Harbour Bakery", footer_text: "Fresh bread every morning" },
  });

  const editor = new ApiClient(apiUrl);
  await editor.signIn(accounts.editor.email, accounts.editor.password);
  return {
    sessions: { owner: owner.sessionToken, editor: editor.sessionToken },
    posts,
    pages,
    images,
  };
}

/**
 * There is no API for inviting people yet, so the editor is written straight into the
 * database. They share the owner's password (and so the owner's password hash), which
 * keeps this independent of how passwords are hashed.
 */
async function addEditor(activeDatabase: ActiveDatabase): Promise<void> {
  const database = activeDatabase.database;
  const [owner] = await database.select().from(usersTable);
  if (!owner?.passwordHash) {
    throw new Error("Setup should have created the owner before the editor is added.");
  }
  const [editor] = await database
    .insert(usersTable)
    .values({
      email: accounts.editor.email,
      name: accounts.editor.name,
      passwordHash: owner.passwordHash,
    })
    .returning();
  const [role] = await database
    .insert(rolesTable)
    .values({ handle: "editor", name: "Editor", permissions: EDITOR_PERMISSIONS })
    .returning();
  if (!editor || !role) {
    throw new Error("The database did not return the editor or their role.");
  }
  await database.insert(userRolesTable).values({ userId: editor.id, roleId: role.id });
}

async function uploadImage(
  api: ApiClient,
  filename: string,
  contentType: string,
  alt: string,
): Promise<SeededAsset> {
  const asset = await api.upload<Asset>(
    filename,
    await readFile(sampleFile(filename)),
    contentType,
  );
  if (alt) {
    await api.patch(`/media/${asset.id}`, { alt });
  }
  return { id: asset.id, filename };
}

export function richText(...paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

async function createEntry(
  api: ApiClient,
  collection: string,
  data: Record<string, unknown>,
  options: { publish?: boolean; slug?: string } = {},
): Promise<SeededEntry> {
  const entry = await api.post<EntryResponse>(`/collections/${collection}/entries`, {
    data,
    ...(options.slug ? { slug: options.slug } : {}),
  });
  if (options.publish) {
    await api.post(`/entries/${entry.id}/publish`);
  }
  return { id: entry.id, title: entry.title, slug: entry.slug };
}

async function seedPosts(api: ApiClient, featuredImageId: string) {
  const published = await createEntry(
    api,
    "posts",
    {
      title: "Our new sourdough",
      excerpt: "A slower bread, worth the wait.",
      featured_image: featuredImageId,
      body: richText("We have been baking a new sourdough for a month."),
    },
    { publish: true },
  );
  const secondPublished = await createEntry(
    api,
    "posts",
    { title: "Opening hours over the holidays", body: richText("We close early on Sunday.") },
    { publish: true },
  );
  const draft = await createEntry(api, "posts", {
    title: "Ideas for the summer menu",
    body: richText("Lemon tart, maybe."),
  });
  return { published, secondPublished, draft };
}

async function seedPages(api: ApiClient, heroImageId: string) {
  const home = await createEntry(
    api,
    "pages",
    {
      title: "Home",
      summary: "A small bakery by the harbour.",
      sections: [
        {
          id: randomUUID(),
          type: "hero",
          data: { heading: "Bread worth waking up for", image: heroImageId },
        },
        { id: randomUUID(), type: "text", data: { body: richText("Baked every morning at six.") } },
      ],
    },
    { publish: true, slug: "home" },
  );
  const about = await createEntry(
    api,
    "pages",
    { title: "About us", body: richText("Three friends and one oven.") },
    { publish: true },
  );
  const translation = await api.post<EntryResponse>(`/entries/${about.id}/translations`, {
    locale: "fr-FR",
  });
  await api.patch(`/entries/${translation.id}`, { data: { title: "À propos" } });
  const aboutInFrench = { id: translation.id, title: "À propos", slug: translation.slug };
  return { home, about, aboutInFrench };
}

async function seedMenu(api: ApiClient, pages: { home: SeededEntry; about: SeededEntry }) {
  const item = (fields: { label?: string; entryId?: string; url?: string }) => ({
    id: randomUUID(),
    label: fields.label ?? "",
    entryId: fields.entryId ?? null,
    url: fields.url ?? null,
    newTab: false,
    children: [],
  });
  await api.put("/navigation/main", {
    items: [
      item({ entryId: pages.home.id }),
      item({ entryId: pages.about.id }),
      item({ label: "Instagram", url: "https://instagram.com/harbourbakery" }),
    ],
  });
}
