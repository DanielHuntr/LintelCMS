import type { SendRequest } from "./test-server.js";

/**
 * The first page at the top of the page tree is the site's "/" (see src/content-roots), so
 * tests about other pages' addresses add a home page first: theirs are then "/about", as on
 * a real site. `locales` are other languages that need a home page of their own.
 */
export async function createHomePage(api: SendRequest, locales: string[] = []): Promise<string> {
  const created = await api("POST", "/collections/pages/entries", {
    data: { title: "Home" },
    slug: "home",
  });
  if (created.statusCode !== 201) {
    throw new Error(`Couldn't create the home page: ${created.body}`);
  }
  const homeId: string = created.json().id;
  for (const locale of locales) {
    await api("POST", `/entries/${homeId}/translations`, { locale });
  }
  return homeId;
}
