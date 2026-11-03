import { z } from "zod";

/**
 * Which template an entry's page uses, kept with its field values under one reserved key,
 * so it is saved, published, previewed and kept in revisions exactly like a field. Field
 * handles start with a letter, so `_template` can never be a field's.
 *
 * - left out: the collection's template (`templates/<collection>.liquid`), else the built-in
 *   one, as before Liquid templates existed;
 * - "designed": the built-in template, which draws the page's visual design;
 * - a template's name ("landing", "pages/wide"): `templates/<name>.liquid`.
 */
export const TEMPLATE_CHOICE_KEY = "_template";

export const DESIGNED_CHOICE = "designed";

/** A template's name: its path under `templates/`, without `.liquid`. */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}(\/[a-z0-9][a-z0-9_-]{0,63}){0,3}$/;

export const templateChoiceSchema = z.union([
  z.literal(DESIGNED_CHOICE),
  z.string().regex(TEMPLATE_NAME_PATTERN),
]);

export type TemplateChoice = z.infer<typeof templateChoiceSchema>;

/** The choice stored in an entry's values, or undefined for "the collection's". */
export function readTemplateChoice(
  data: Readonly<Record<string, unknown>> | null | undefined,
): TemplateChoice | undefined {
  const parsed = templateChoiceSchema.safeParse(data?.[TEMPLATE_CHOICE_KEY]);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Checked values with the template choice put back: checking against the blueprint drops
 * every key that isn't a field. A choice that isn't a template name (or is null, which
 * clears it) is dropped too.
 */
export function keepTemplateChoice(
  sent: Readonly<Record<string, unknown>>,
  checked: Record<string, unknown>,
): Record<string, unknown> {
  const choice = readTemplateChoice(sent);
  return choice === undefined ? checked : { ...checked, [TEMPLATE_CHOICE_KEY]: choice };
}
