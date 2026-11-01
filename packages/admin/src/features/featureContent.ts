import type { StringKey } from "../i18n/strings.js";
import type { Feature } from "./features.api.js";

/**
 * What switching a feature off leaves behind, for features that hold content. Switching off
 * never deletes anything (see core's plugins.service.ts), so the confirmation says so.
 * Built-in features without content (SEO tools) switch off straight away. Installed plugins
 * may keep anything, so they always ask.
 */
const keptContentMessages: Partial<Record<string, StringKey>> = {
  blog: "features.keptContent.blog",
  commerce: "features.keptContent.commerce",
  forms: "features.keptContent.forms",
};

export function keptContentMessageFor(
  feature: Pick<Feature, "id" | "source">,
): StringKey | undefined {
  if (feature.source === "installed") {
    return "features.keptContent.installed";
  }
  return keptContentMessages[feature.id];
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
