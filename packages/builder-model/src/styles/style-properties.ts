/**
 * Every CSS property the builder can set, in one visible list. A node's styles may only use
 * these, so a stored page can never smuggle in a property nobody can see in the style panel.
 *
 * Keys are camelCase (as in the style panel and the stored JSON); `cssName` is what the
 * stylesheet prints. `group` is the style panel section the property belongs to.
 */

export const styleGroups = [
  "layout",
  "spacing",
  "size",
  "position",
  "typography",
  "background",
  "borders",
  "effects",
  "transform",
  "shape",
  "filters",
] as const;

export type StyleGroup = (typeof styleGroups)[number];

interface StylePropertyInfo {
  cssName: string;
  group: StyleGroup;
  /**
   * Names browsers still need alongside the standard one, printed first. Kept to the few
   * that matter today (Safari's `-webkit-backdrop-filter`, `-webkit-background-clip: text`).
   */
  alsoPrintedAs?: readonly string[];
}

function property(
  cssName: string,
  group: StyleGroup,
  alsoPrintedAs?: readonly string[],
): StylePropertyInfo {
  return alsoPrintedAs ? { cssName, group, alsoPrintedAs } : { cssName, group };
}

export const styleProperties = {
  display: property("display", "layout"),
  flexDirection: property("flex-direction", "layout"),
  flexWrap: property("flex-wrap", "layout"),
  justifyContent: property("justify-content", "layout"),
  alignItems: property("align-items", "layout"),
  alignSelf: property("align-self", "layout"),
  gap: property("gap", "layout"),
  rowGap: property("row-gap", "layout"),
  columnGap: property("column-gap", "layout"),
  gridTemplateColumns: property("grid-template-columns", "layout"),
  gridTemplateRows: property("grid-template-rows", "layout"),
  gridAutoRows: property("grid-auto-rows", "layout"),
  gridColumn: property("grid-column", "layout"),
  gridRow: property("grid-row", "layout"),
  gridArea: property("grid-area", "layout"),
  gridTemplateAreas: property("grid-template-areas", "layout"),
  justifySelf: property("justify-self", "layout"),
  justifyItems: property("justify-items", "layout"),
  flexGrow: property("flex-grow", "layout"),
  flexShrink: property("flex-shrink", "layout"),
  flexBasis: property("flex-basis", "layout"),
  order: property("order", "layout"),

  marginTop: property("margin-top", "spacing"),
  marginRight: property("margin-right", "spacing"),
  marginBottom: property("margin-bottom", "spacing"),
  marginLeft: property("margin-left", "spacing"),
  paddingTop: property("padding-top", "spacing"),
  paddingRight: property("padding-right", "spacing"),
  paddingBottom: property("padding-bottom", "spacing"),
  paddingLeft: property("padding-left", "spacing"),

  width: property("width", "size"),
  height: property("height", "size"),
  minWidth: property("min-width", "size"),
  maxWidth: property("max-width", "size"),
  minHeight: property("min-height", "size"),
  maxHeight: property("max-height", "size"),
  aspectRatio: property("aspect-ratio", "size"),
  objectFit: property("object-fit", "size"),
  objectPosition: property("object-position", "size"),
  overflow: property("overflow", "size"),

  position: property("position", "position"),
  top: property("top", "position"),
  right: property("right", "position"),
  bottom: property("bottom", "position"),
  left: property("left", "position"),
  zIndex: property("z-index", "position"),

  fontFamily: property("font-family", "typography"),
  fontSize: property("font-size", "typography"),
  fontWeight: property("font-weight", "typography"),
  fontStyle: property("font-style", "typography"),
  lineHeight: property("line-height", "typography"),
  letterSpacing: property("letter-spacing", "typography"),
  textAlign: property("text-align", "typography"),
  textTransform: property("text-transform", "typography"),
  textDecoration: property("text-decoration", "typography"),
  color: property("color", "typography"),
  textStroke: property("-webkit-text-stroke", "typography"),
  // With a stroke, a see-through fill makes outlined (hollow) letters in the text's colour.
  textFillColor: property("-webkit-text-fill-color", "typography"),
  textShadow: property("text-shadow", "typography"),
  writingMode: property("writing-mode", "typography"),
  textOrientation: property("text-orientation", "typography"),
  textWrap: property("text-wrap", "typography"),
  whiteSpace: property("white-space", "typography"),

  backgroundColor: property("background-color", "background"),
  backgroundImage: property("background-image", "background"),
  backgroundSize: property("background-size", "background"),
  backgroundPosition: property("background-position", "background"),
  backgroundRepeat: property("background-repeat", "background"),
  backgroundAttachment: property("background-attachment", "background"),
  backgroundClip: property("background-clip", "background", ["-webkit-background-clip"]),

  borderWidth: property("border-width", "borders"),
  borderStyle: property("border-style", "borders"),
  borderColor: property("border-color", "borders"),
  borderRadius: property("border-radius", "borders"),

  opacity: property("opacity", "effects"),
  boxShadow: property("box-shadow", "effects"),
  cursor: property("cursor", "effects"),

  rotate: property("rotate", "transform"),
  scale: property("scale", "transform"),
  translate: property("translate", "transform"),
  transform: property("transform", "transform"),
  transformOrigin: property("transform-origin", "transform"),

  clipPath: property("clip-path", "shape"),
  maskImage: property("mask-image", "shape", ["-webkit-mask-image"]),
  maskSize: property("mask-size", "shape", ["-webkit-mask-size"]),
  maskPosition: property("mask-position", "shape", ["-webkit-mask-position"]),
  maskRepeat: property("mask-repeat", "shape", ["-webkit-mask-repeat"]),

  mixBlendMode: property("mix-blend-mode", "filters"),
  backgroundBlendMode: property("background-blend-mode", "filters"),
  filter: property("filter", "filters"),
  backdropFilter: property("backdrop-filter", "filters", ["-webkit-backdrop-filter"]),
  isolation: property("isolation", "filters"),
} as const satisfies Record<string, StylePropertyInfo>;

export type StylePropertyName = keyof typeof styleProperties;

export const stylePropertyNames = Object.keys(styleProperties) as StylePropertyName[];

export function isStylePropertyName(name: string): name is StylePropertyName {
  return Object.hasOwn(styleProperties, name);
}

/** The longest value a style may have; real values are far shorter. Image layers may be longer. */
export const maxStyleValueLength = 200;

/**
 * A value is plain CSS such as `16px`, `var(--lintel-space-3)` or `repeat(3, 1fr)`. Anything
 * that could end the declaration or start another rule (`;`, braces, angle brackets,
 * backslashes, comments) is refused, and so are `url(...)`, `expression(...)` and at-rules,
 * so a stored value can only ever be the value of its own property.
 */
export function isSafeStyleValue(value: string): boolean {
  if (value.length === 0 || value.length > maxStyleValueLength) return false;
  if (/[;{}<>\\@]|\/\*|\*\//.test(value)) return false;
  if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return false;
  return /^[\w\s#%().,\-+*/'"!]+$/.test(value);
}
