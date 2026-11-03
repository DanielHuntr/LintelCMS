import type { FastifyInstance } from "fastify";

/**
 * The public website, at every address the API and the admin don't use. This is where the
 * site renderer plugs in: it is a Fastify plugin registered last, at the root, given
 * where the API and the admin are. Until there is one, a placeholder page says the site
 * is on its way and points editors to the admin.
 *
 * A site built separately (such as the Next.js starter) runs as its own app and reads the
 * API at `<PUBLIC_URL>/api`; it doesn't need this hook at all.
 */
export interface PublicSiteOptions {
  /** Where the API's routes are, such as "/api". */
  apiPrefix: string;
  adminPath: string;
}

export type PublicSite = (server: FastifyInstance, options: PublicSiteOptions) => Promise<void>;

export const placeholderPublicSite: PublicSite = async (server, options) => {
  server.get("/", async (_request, reply) =>
    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(placeholderPage(options.adminPath)),
  );

  // Search engines look for these at the site's root; the SEO plugin makes them in the API.
  for (const file of ["/sitemap.xml", "/robots.txt"]) {
    server.get(file, async (request, reply) => {
      const fromApi = await server.inject({
        method: "GET",
        url: `${options.apiPrefix}${file}`,
        headers: { host: request.headers.host ?? "localhost" },
      });
      for (const header of ["content-type", "cache-control"]) {
        const value = fromApi.headers[header];
        if (typeof value === "string") reply.header(header, value);
      }
      return reply.code(fromApi.statusCode).send(fromApi.rawPayload);
    });
  }
};

function placeholderPage(adminPath: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Coming soon</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
      main { max-width: 32rem; text-align: center; line-height: 1.5; }
      h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
      a { color: #0066cc; }
      @media (prefers-color-scheme: dark) { a { color: #4aa3ff; } }
    </style>
  </head>
  <body>
    <main>
      <h1>This website is on its way</h1>
      <p>There's nothing to see here yet. Please check back soon.</p>
      <p><a href="${adminPath}">Sign in to edit this site</a></p>
    </main>
  </body>
</html>
`;
}
