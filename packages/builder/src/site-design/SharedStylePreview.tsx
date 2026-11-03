import {
  type DesignVariable,
  designTokens,
  findTokenByValue,
  type SharedStyle,
  variablesAsTokens,
} from "@lintel/builder-model";
import { useSiteDesign } from "./site-design-context.js";

/** A value as the builder's own page can draw it: tokens and variables become their values. */
function previewValue(value: string | undefined, variables: readonly DesignVariable[]) {
  if (!value) return undefined;
  const tokens = [
    ...designTokens,
    ...variablesAsTokens(variables, "colour"),
    ...variablesAsTokens(variables, "size"),
    ...variablesAsTokens(variables, "font"),
  ];
  return findTokenByValue(value, tokens)?.fallback ?? (value.includes("var(") ? undefined : value);
}

/** A small tile drawn with a shared style's colours, corners and border: "Aa" on its fill. */
export function SharedStylePreview({ sharedStyle }: { sharedStyle: SharedStyle }) {
  const { design } = useSiteDesign();
  const base = sharedStyle.styles.base;
  const read = (value: string | undefined) => previewValue(value, design.variables);
  const background = read(base.backgroundColor);
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: background,
        // Text colour only on the style's own fill: on the panel it might not be readable.
        color: background && background !== "transparent" ? read(base.color) : undefined,
        borderColor: read(base.borderColor),
        borderStyle: base.borderWidth ? "solid" : undefined,
        borderWidth: base.borderWidth ? "1px" : undefined,
        borderRadius: base.borderRadius ? "999px" : undefined,
        fontFamily: read(base.fontFamily),
        fontWeight: base.fontWeight,
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-control bg-fill text-caption text-label hairline-ring"
    >
      Aa
    </span>
  );
}
