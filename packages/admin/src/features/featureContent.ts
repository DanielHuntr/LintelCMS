import type { StringKey } from "../i18n/strings.js";

/**
 * What switching a feature off leaves behind, for features that hold content. Switching off
 * never deletes anything (see core's plugins.service.ts), so the confirmation says so.
 * Features without content (SEO tools) switch off straight away.
 */
const keptContentMessages: Partial<Record<string, StringKey>> = {
  blog: "features.keptContent.blog",
  commerce: "features.keptContent.commerce",
  forms: "features.keptContent.forms",
};

export function keptContentMessageFor(featureId: string): StringKey | undefined {
  return keptContentMessages[featureId];
}

/** The enabled ids after one switch is flipped, in the API's order. */
export function enabledAfterToggle(
  allIds: readonly string[],
  enabledIds: readonly string[],
  featureId: string,
  isOn: boolean,
): string[] {
  return allIds.filter((id) => (id === featureId ? isOn : enabledIds.includes(id)));
}
