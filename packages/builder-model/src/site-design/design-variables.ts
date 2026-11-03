import { z } from "zod";
import { isSafeStyleValue } from "../styles/style-properties.js";
import { slugifyClassName } from "../styles/class-names.js";
import type { DesignToken } from "../tokens/design-tokens.js";

/**
 * The site's own design variables: colours, sizes and fonts with names people choose
 * ("Sand", "Wide gutter", "Display"), alongside the theme's tokens. Each is a CSS custom
 * property on the website (`--lintel-var-sand: #efe6d6`), and a style that uses one stores
 * `var(--lintel-var-sand)`, so changing the variable changes every element that uses it, on
 * every page, without touching the pages.
 *
 * The theme's own tokens (Brand, Text, the spacing steps...) stay as they are, set by the
 * site's theme; these are added after them in the style panel's swatches and choices.
 */
export const designVariableKinds = ["colour", "size", "font"] as const;
export type DesignVariableKind = (typeof designVariableKinds)[number];

export interface DesignVariable {
  /** Made from the first name and never changed, so renaming keeps every use working. */
  id: string;
  name: string;
  kind: DesignVariableKind;
  value: string;
  /**
   * For a colour: its value under the site's dark colour scheme (the visitor's dark mode
   * with an automatic theme, or always with a dark one). Left out, it's the same in both.
   */
  darkValue?: string;
}

export const maxDesignVariables = 100;

const colourPattern = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([\d\s.,%/+-]+\))$/i;
const sizePattern = /^(-?[\d.]+(px|rem|em|vw|vh|%)|0|(clamp|min|max|calc)\([\w\s.,%()+*/-]+\))$/;

/** Whether `value` is something a variable of this kind may hold. */
export function isDesignVariableValue(kind: DesignVariableKind, value: string): boolean {
  if (!isSafeStyleValue(value)) return false;
  if (kind === "colour") return colourPattern.test(value.trim());
  if (kind === "size") return sizePattern.test(value.trim());
  return value.trim().length > 0 && value.length <= 200;
}

export const designVariableSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, {
      error: "A variable’s id should be a short name like “sand”",
    }),
    name: z
      .string({ error: "Please give the variable a name" })
      .trim()
      .min(1, { error: "Please give the variable a name" })
      .max(40, { error: "Variable names can be at most 40 characters" }),
    kind: z.enum(designVariableKinds, { error: "A variable is a colour, a size or a font" }),
    value: z.string({ error: "A variable needs a value" }),
    darkValue: z.string().optional(),
  })
  .refine((variable) => isDesignVariableValue(variable.kind, variable.value), {
    error: "That value can’t be used for this variable",
    path: ["value"],
  })
  .refine(
    (variable) =>
      variable.darkValue === undefined ||
      (variable.kind === "colour" && isDesignVariableValue("colour", variable.darkValue)),
    { error: "A dark-mode value must be a colour, for a colour", path: ["darkValue"] },
  );

/** The custom property a variable sets, without the leading dashes. */
export function variablePropertyName(variable: Pick<DesignVariable, "id">): string {
  return `lintel-var-${variable.id}`;
}

/** What a style stores to use a variable: `var(--lintel-var-sand)`. */
export function variableValue(variable: Pick<DesignVariable, "id">): string {
  return `var(--${variablePropertyName(variable)})`;
}

/**
 * An id for a new variable from its name, unique among `taken`: "Sand" is `sand`, a second
 * "Sand" is `sand-2`.
 */
export function newVariableId(name: string, taken: readonly string[]): string {
  const slug = slugifyClassName(name).replace(/^el-/, "v-").slice(0, 32) || "variable";
  const base = /^[a-z]/.test(slug) ? slug : `v-${slug}`;
  let id = base;
  for (let count = 2; taken.includes(id); count += 1) id = `${base}-${count}`;
  return id;
}

/** Variables as tokens, so the style panel's swatches and choices can offer them. */
export function variablesAsTokens(
  variables: readonly DesignVariable[],
  kind: DesignVariableKind,
): DesignToken[] {
  return variables
    .filter((variable) => variable.kind === kind)
    .map((variable) => ({
      name: variablePropertyName(variable),
      label: variable.name,
      fallback: variable.value,
    }));
}

/** A colour variable's dark-mode value, when it has one that can be used. */
export function darkValueOf(variable: DesignVariable): string | undefined {
  return variable.kind === "colour" &&
    variable.darkValue !== undefined &&
    isDesignVariableValue("colour", variable.darkValue)
    ? variable.darkValue.trim()
    : undefined;
}

/**
 * The variables as a `:root` rule for the website's stylesheet; empty for none.
 *
 * A colour with a dark-mode value is written as `light-dark(light, dark)`, which follows the
 * `color-scheme` the theme's stylesheet sets on the page: the visitor's own choice with an
 * automatic theme, always light or always dark with a fixed one. Browsers too old for
 * `light-dark()` get the light value.
 */
export function designVariablesStylesheet(variables: readonly DesignVariable[]): string {
  const safe = variables.filter((variable) => isDesignVariableValue(variable.kind, variable.value));
  if (safe.length === 0) return "";
  const lines = safe.map((variable) => {
    const dark = darkValueOf(variable);
    const light = variable.value.trim();
    const value = dark ? `light-dark(${light}, ${dark})` : light;
    return `  --${variablePropertyName(variable)}: ${value};`;
  });
  const withDark = safe.filter((variable) => darkValueOf(variable) !== undefined);
  const fallback =
    withDark.length === 0
      ? ""
      : `@supports not (color: light-dark(#000, #fff)) {\n  :root {\n${withDark
          .map((variable) => `    --${variablePropertyName(variable)}: ${variable.value.trim()};`)
          .join("\n")}\n  }\n}\n`;
  return `:root {\n${lines.join("\n")}\n}\n${fallback}`;
}
