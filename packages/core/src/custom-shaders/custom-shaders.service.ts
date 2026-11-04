import { customShaderLimits, readCustomShader } from "@lintel/motion/effects";
import { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import { HttpError, InvalidFieldsError, parseRequest } from "../http/http-errors.js";
import { readSetting } from "../settings/settings.service.js";
import type { Site } from "../sites/sites.table.js";
import { findStoredShaders, saveStoredShaders } from "./custom-shaders.repository.js";

/**
 * The site's own shaders: code a developer wrote once, and the rest of the site uses as a
 * layer. Pages only name a shader, so changing it here changes it everywhere, and people who
 * can't write code can still use one. The code isn't trusted: it is checked here and again
 * on the page (`readCustomShader`), and it never reaches a page while the site removes
 * scripts (see docs/decisions/0066-shader-studio.md).
 */

/** How many shaders one site can keep. */
export const maxCustomShaders = 40;

const savedShaderSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1, { error: "Give the shader a name" }).max(60),
  code: z.string().max(customShaderLimits.size),
});

export type SavedShader = z.output<typeof savedShaderSchema>;

export class CustomCodeOffError extends HttpError {
  constructor() {
    super(
      403,
      "CUSTOM_CODE_OFF",
      "This site doesn't allow custom code. Someone who manages its settings can turn it on.",
    );
  }
}

export interface ShaderLibrary {
  shaders: SavedShader[];
  /** Whether the site allows custom code, and so whether shaders are drawn and can be saved. */
  allowed: boolean;
}

async function readShaders(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
): Promise<SavedShader[]> {
  const parsed = z.array(savedShaderSchema).safeParse(await findStoredShaders(database, site.id));
  return parsed.success ? parsed.data : [];
}

export async function readShaderLibrary(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
): Promise<ShaderLibrary> {
  const [shaders, rule] = await Promise.all([
    readShaders(database, site),
    readSetting(database, "builderCustomScripts"),
  ]);
  return { shaders, allowed: rule === "allowScripts" };
}

/**
 * The code of each saved shader, by id, for drawing pages. Empty while the site removes
 * scripts, also for shaders saved while it allowed them, so changing the rule takes effect
 * on the next page drawn: those sections show their plain background.
 */
export async function readShadersForPages(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
): Promise<Record<string, string>> {
  const { shaders, allowed } = await readShaderLibrary(database, site);
  return allowed ? Object.fromEntries(shaders.map(({ id, code }) => [id, code])) : {};
}

export async function saveShader(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
  id: string,
  sent: unknown,
): Promise<SavedShader> {
  const { shaders, allowed } = await readShaderLibrary(database, site);
  if (!allowed) throw new CustomCodeOffError();
  const saved = parseRequest(savedShaderSchema, { ...(sent as object), id });
  const problem = readCustomShader(saved.code).problems[0];
  if (problem) throw new InvalidFieldsError({ code: problem.message });
  const others = shaders.filter((shader) => shader.id !== id);
  if (others.length >= maxCustomShaders) {
    throw new InvalidFieldsError({
      name: `A site can keep ${maxCustomShaders} shaders. Delete one to add another.`,
    });
  }
  const at = shaders.findIndex((shader) => shader.id === id);
  await saveStoredShaders(
    database,
    site.id,
    at === -1
      ? [...shaders, saved]
      : shaders.map((shader, index) => (index === at ? saved : shader)),
  );
  return saved;
}

export async function deleteShader(
  database: DatabaseOrTransaction,
  site: Pick<Site, "id">,
  id: string,
): Promise<void> {
  const shaders = await readShaders(database, site);
  await saveStoredShaders(
    database,
    site.id,
    shaders.filter((shader) => shader.id !== id),
  );
}
