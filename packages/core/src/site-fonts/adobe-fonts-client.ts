import { adobeStylesheetUrl, type FontCategory, fontFamilyNameSchema } from "@lintel/builder-model";
import type { FontNetwork } from "./font-network.js";

/**
 * Adobe Fonts web projects. Adobe's licence has its fonts served by Adobe, through the
 * project's stylesheet (https://use.typekit.net/<id>.css), and only on the domains listed in
 * the project. Lintel reads that stylesheet once, when the project is connected, to learn
 * which families it has; the website then links to it on every page.
 */
const MAX_STYLESHEET_BYTES = 512 * 1024;

export interface AdobeFamily {
  family: string;
  category: FontCategory;
  weights: string[];
  hasItalic: boolean;
}

export interface AdobeFontsClient {
  /** The project's families; null when Adobe doesn't know the project. */
  readProject(projectId: string): Promise<AdobeFamily[] | null>;
}

export function createAdobeFontsClient(network: FontNetwork): AdobeFontsClient {
  return {
    async readProject(projectId) {
      const css = await network.readText(
        adobeStylesheetUrl(projectId),
        "adobe",
        MAX_STYLESHEET_BYTES,
      );
      return css === null ? null : readAdobeFamilies(css);
    },
  };
}

/**
 * The families in an Adobe project's stylesheet, from its `@font-face` rules, with the kind
 * of font taken from the fallback in its `.tk-<family>` class ("sans-serif", "serif").
 */
export function readAdobeFamilies(css: string): AdobeFamily[] {
  const families = new Map<string, { weights: Set<string>; hasItalic: boolean }>();
  for (const [, rule = ""] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family:\s*["']?([^"';]+)["']?/i.exec(rule)?.[1]?.trim();
    if (!family || !fontFamilyNameSchema.safeParse(family).success) continue;
    const weight = /font-weight:\s*(\d{3})/i.exec(rule)?.[1] ?? "400";
    const italic = /font-style:\s*(italic|oblique)/i.test(rule);
    const entry = families.get(family) ?? { weights: new Set<string>(), hasItalic: false };
    entry.weights.add(weight);
    entry.hasItalic ||= italic;
    families.set(family, entry);
  }
  return [...families].map(([family, entry]) => ({
    family,
    category: categoryFromFallback(css, family),
    weights: [...entry.weights].sort(),
    hasItalic: entry.hasItalic,
  }));
}

function categoryFromFallback(css: string, family: string): FontCategory {
  const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fallback =
    new RegExp(`font-family:\\s*["']${escaped}["']\\s*,\\s*([a-z-]+)`, "i").exec(css)?.[1] ?? "";
  if (fallback === "serif") return "serif";
  if (fallback === "monospace") return "mono";
  if (fallback === "cursive") return "script";
  if (fallback === "fantasy") return "display";
  return "sans";
}
