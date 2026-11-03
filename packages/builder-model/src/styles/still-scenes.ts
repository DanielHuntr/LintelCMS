import type { PageNode } from "../document/page-document.schema.js";

/**
 * A held sideways scene (the page stops while a row of panels slides past) only works while
 * its animation runs. For people who ask their device for less motion, and when scripts don't
 * run, nothing holds the page or moves the row, so it would sit in a box several screens wide
 * with only the first panel showing. These rules stack the panels down the page instead:
 *
 *   @media (prefers-reduced-motion: reduce), (scripting: none) {
 *     .scene > * > :last-child { flex-direction: column; width: auto; ... }
 *     .scene > * > :last-child > * { width: auto; }
 *   }
 *
 * With motion allowed and scripts running, none of this applies, so the scene plays as designed.
 */
export function compileStillScenes(
  nodes: readonly PageNode[],
  classNames: ReadonlyMap<string, string>,
): string | null {
  const rules = nodes.flatMap((node) => {
    const className = classNames.get(node.id);
    if (!className) return [];
    return (node.animations ?? []).flatMap(({ spec }) => {
      const sideways =
        spec.trigger.type === "scroll" &&
        spec.trigger.pin !== undefined &&
        spec.targets.type === "selector" &&
        spec.tracks.some((track) => track.property === "translateX");
      if (!sideways || spec.targets.type !== "selector") return [];
      const rows = spec.targets.selector
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .map((part) =>
          part.startsWith(":scope")
            ? `.${className}${part.slice(":scope".length)}`
            : `.${className} ${part}`,
        );
      if (rows.length === 0) return [];
      return [
        `  ${rows.join(",\n  ")} {\n    display: flex;\n    flex-direction: column;\n    flex-wrap: nowrap;\n    width: auto;\n    max-width: 100%;\n    transform: none;\n  }`,
        `  ${rows.map((row) => `${row} > *`).join(",\n  ")} {\n    width: auto;\n    max-width: 100%;\n  }`,
      ];
    });
  });
  return rules.length === 0
    ? null
    : `@media (prefers-reduced-motion: reduce), (scripting: none) {\n${rules.join("\n\n")}\n}`;
}
