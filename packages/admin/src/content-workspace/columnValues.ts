import { t } from "../i18n/strings.js";

const MAX_LENGTH = 80;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A field's saved value as a short line of text for a list column: text as it is (cut to a
 * readable length), numbers and yes/no as words, lists joined, and anything richer (rich
 * text, images, blocks, links to other content by id) left out, since a cell can't show it well.
 */
export function formatColumnValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return ID_PATTERN.test(value) ? "" : shorten(value);
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? t("collectionView.yes") : t("collectionView.no");
  if (Array.isArray(value)) {
    const words = value.filter(
      (item): item is string | number =>
        typeof item === "number" || (typeof item === "string" && !ID_PATTERN.test(item)),
    );
    return words.length === value.length ? shorten(words.join(", ")) : "";
  }
  return "";
}

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_LENGTH ? `${oneLine.slice(0, MAX_LENGTH - 1).trimEnd()}…` : oneLine;
}
