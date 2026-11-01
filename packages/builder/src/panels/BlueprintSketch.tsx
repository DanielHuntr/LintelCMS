import type { NodeBlueprint } from "@lintel/builder-model";
import type { ReactNode } from "react";

/**
 * A small wireframe of a section template, drawn from the template itself: headings as thick
 * bars, text as thin lines, buttons as pills, pictures as tinted boxes, columns side by side.
 * New templates get a thumbnail without anyone drawing one. Purely decorative.
 */
export function BlueprintSketch({
  blueprint,
  size = "regular",
}: {
  blueprint: NodeBlueprint;
  /** Small fits two to a row in the Insert panel. */
  size?: "regular" | "small";
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex w-full flex-col overflow-hidden rounded-control bg-surface hairline-ring ${size === "small" ? "h-16 p-1.5" : "h-24 p-2"}`}
    >
      {sketch(blueprint, "0")}
    </div>
  );
}

function sketch(blueprint: NodeBlueprint, key: string): ReactNode {
  const children = (blueprint.children ?? []).map((child, index) =>
    sketch(child, `${key}.${index}`),
  );
  const styles = blueprint.styles?.base ?? {};
  const centred = styles.alignItems === "center" || styles.textAlign === "center";
  const tinted = styles.backgroundColor?.includes("brand");
  const panel = styles.backgroundColor?.includes("surface");
  const dark = styles.backgroundColor?.includes("color-text");

  switch (blueprint.type) {
    case "page":
      return (
        <div key={key} className="flex flex-1 flex-col gap-1">
          {children}
        </div>
      );
    case "section":
      return (
        <div
          key={key}
          className={`flex flex-1 flex-col justify-center gap-1 rounded px-2 py-1.5 ${tinted ? "bg-accent-fill/80" : dark ? "bg-label/80" : panel ? "bg-fill" : ""}`}
        >
          {children}
        </div>
      );
    case "container":
    case "box":
      return (
        <div
          key={key}
          className={`flex min-w-0 flex-1 flex-col gap-1 ${centred ? "items-center" : ""} ${panel ? "rounded bg-fill p-1" : ""}`}
        >
          {children}
        </div>
      );
    case "columns":
      return (
        <div key={key} className="flex min-w-0 gap-1.5">
          {children}
        </div>
      );
    case "heading": {
      const level = Number(blueprint.props?.level ?? 2);
      return (
        <span
          key={key}
          className={`block rounded-full bg-label/70 ${level === 1 ? "h-2.5 w-4/5" : level === 2 ? "h-2 w-3/5" : "h-1.5 w-2/5"}`}
        />
      );
    }
    case "text":
    case "quote":
      return (
        <span key={key} className={`flex w-full flex-col gap-0.5 ${centred ? "items-center" : ""}`}>
          <span className="block h-1 w-11/12 rounded-full bg-label-tertiary/60" />
          <span className="block h-1 w-3/4 rounded-full bg-label-tertiary/60" />
        </span>
      );
    case "button":
      return <span key={key} className="block h-2.5 w-10 rounded-full bg-accent-fill" />;
    case "link":
      return <span key={key} className="block h-1 w-8 rounded-full bg-accent" />;
    case "image":
      return <span key={key} className="block h-12 w-full rounded bg-fill-strong" />;
    case "list":
      return (
        <span key={key} className="flex w-full flex-col gap-0.5">
          <span className="block h-1 w-1/2 rounded-full bg-label-tertiary/60" />
          <span className="block h-1 w-2/5 rounded-full bg-label-tertiary/60" />
        </span>
      );
    case "divider":
      return <span key={key} className="block h-px w-full bg-separator" />;
    default:
      return <span key={key} className="block h-3 w-full rounded bg-fill" />;
  }
}
