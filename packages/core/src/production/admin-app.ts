import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply } from "fastify";

/**
 * Serves the built admin (`pnpm build` puts it in packages/admin/dist) at ADMIN_PATH,
 * /admin by default. The admin is built once and works at any path: this tells it where it
 * is, and where the API is, in its index.html (a `<base>` tag and a `lintel-admin` meta tag
 * that packages/admin/src/runtime-settings.ts reads).
 *
 * Built files have a fingerprint in their names, so they are cached for a year; index.html
 * is checked on every visit, so an update reaches everyone straight away.
 */

/** packages/admin/dist, the same place from `src` and from `dist`. */
export const DEFAULT_ADMIN_BUILD_FOLDER = fileURLToPath(
  new URL("../../../admin/dist", import.meta.url),
);

export interface AdminAppOptions {
  /** Such as "/admin": no trailing slash. */
  adminPath: string;
  buildFolder: string;
  /** Where the admin's requests go: a path on this server ("/api") or a full address. */
  apiUrl: string;
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const ONE_HOUR_IN_SECONDS = 60 * 60;

export async function adminApp(server: FastifyInstance, options: AdminAppOptions) {
  const indexFile = join(options.buildFolder, "index.html");
  if (!existsSync(indexFile)) {
    server.log.warn(
      { buildFolder: options.buildFolder },
      "The admin hasn't been built, so it can't be shown. Run `pnpm build` and restart.",
    );
    server.get(options.adminPath, async (_request, reply) => sendAdminMissing(reply));
    server.get(`${options.adminPath}/*`, async (_request, reply) => sendAdminMissing(reply));
    return;
  }

  const indexHtml = withRuntimeSettings(readFileSync(indexFile, "utf8"), options);

  // Vite puts every fingerprinted file in assets/.
  const fingerprintedFolder = join(options.buildFolder, "assets");
  await server.register(fastifyStatic, {
    root: options.buildFolder,
    prefix: `${options.adminPath}/`,
    // One route per built file, so any other address under the admin is a page of the app.
    wildcard: false,
    index: false,
    cacheControl: false,
    setHeaders: (response, path) => {
      const fingerprinted = path.startsWith(fingerprintedFolder);
      response.header(
        "cache-control",
        fingerprinted
          ? `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`
          : `public, max-age=${ONE_HOUR_IN_SECONDS}`,
      );
      response.header("x-content-type-options", "nosniff");
    },
  });

  const sendIndex = async (_request: unknown, reply: FastifyReply) =>
    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-cache")
      .header("x-content-type-options", "nosniff")
      .header("x-frame-options", "SAMEORIGIN")
      .header("referrer-policy", "same-origin")
      .send(indexHtml);

  server.get(options.adminPath, sendIndex);
  server.get(`${options.adminPath}/*`, sendIndex);
}

/** Adds the admin's address and the API's to index.html, at the top of its <head>. */
export function withRuntimeSettings(
  indexHtml: string,
  options: Pick<AdminAppOptions, "adminPath" | "apiUrl">,
): string {
  const settings = JSON.stringify({ basePath: options.adminPath, apiUrl: options.apiUrl });
  const tags =
    `<base href="${escapeAttribute(`${options.adminPath}/`)}" />` +
    `<meta name="lintel-admin" content="${escapeAttribute(settings)}" />`;
  return indexHtml.replace(/<head>/i, (head) => `${head}${tags}`);
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sendAdminMissing(reply: FastifyReply) {
  return reply
    .code(503)
    .type("text/html; charset=utf-8")
    .header("cache-control", "no-store")
    .send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Admin not built</title></head>' +
        "<body><h1>The admin isn't ready</h1><p>Lintel is running, but its admin hasn't been " +
        "built. Run <code>pnpm build</code>, then start Lintel again.</p></body></html>",
    );
}
