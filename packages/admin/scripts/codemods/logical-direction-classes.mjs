/**
 * Swaps Tailwind classes tied to left and right for their logical twins, so the admin
 * mirrors in right-to-left languages: ml-2 → ms-2, pr-4 → pe-4, left-3 → inset-s-3,
 * text-left → text-start, rounded-r-full → rounded-e-full, and so on. Safe to run again.
 *
 * Centring with left-1/2 plus -translate-x-1/2 is left as it is: it's symmetrical anyway,
 * and translate isn't logical. Anything else that slides sideways needs an `rtl:` twin by
 * hand (see src/i18n/README.md).
 *
 * Run from packages/admin: node scripts/codemods/logical-direction-classes.mjs
 */
import { sep } from "node:path";
import { isStringsFile, listSourceFiles, rewriteFiles } from "./source-files.mjs";

const logicalNames = {
  ml: "ms",
  mr: "me",
  pl: "ps",
  pr: "pe",
  left: "inset-s",
  right: "inset-e",
  "scroll-ml": "scroll-ms",
  "scroll-mr": "scroll-me",
  "scroll-pl": "scroll-ps",
  "scroll-pr": "scroll-pe",
  "border-l": "border-s",
  "border-r": "border-e",
  "rounded-l": "rounded-s",
  "rounded-r": "rounded-e",
  "rounded-tl": "rounded-ss",
  "rounded-tr": "rounded-se",
  "rounded-bl": "rounded-es",
  "rounded-br": "rounded-ee",
};

const prefixes = Object.keys(logicalNames)
  .sort((first, second) => second.length - first.length)
  .join("|");

/** A Tailwind value: 3, 2.5, 1/3, [264px], px, auto, full, or a colour/size name for borders. */
const value = String.raw`(?:\d+(?:\.\d+)?|\d+\/\d+|\[[^\]\s"'\`]+\]|px|auto|full|none|sm|md|lg|xl|2xl|3xl|card|control|panel|[a-z]+(?:-[a-z]+)*\/\d+|[a-z]+(?:-[a-z]+)*)`;

const physicalClass = new RegExp(
  String.raw`(?<=^|[\s"'\`:])(-?)(${prefixes})(?:-(${value}))?(?=[\s"'\`]|$)`,
  "g",
);

export function useLogicalClasses(source) {
  return source
    .replace(physicalClass, (match, negative, prefix, classValue) => {
      const isBorderOrRounded = prefix.startsWith("border") || prefix.startsWith("rounded");
      if (classValue === undefined && !isBorderOrRounded) return match;
      if (!isBorderOrRounded && !/^(\d|\[|px$|auto$|full$)/.test(classValue ?? "")) return match;
      if ((prefix === "left" || prefix === "right") && classValue === "1/2") return match;
      const suffix = classValue === undefined ? "" : `-${classValue}`;
      return `${negative}${logicalNames[prefix]}${suffix}`;
    })
    .replace(/(?<=[\s"'`:])text-left(?=[\s"'`])/g, "text-start")
    .replace(/(?<=[\s"'`:])text-right(?=[\s"'`])/g, "text-end");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const changed = rewriteFiles(
    listSourceFiles().filter((path) => !isStringsFile(path) && !path.includes(`${sep}i18n${sep}`)),
    useLogicalClasses,
  );
  console.warn(`Logical classes: ${changed} files changed.`);
}
