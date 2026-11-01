import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  fontFamilyValue,
  freePlaceStyles,
  type NodeBlueprint,
  type NodeStyles,
  type PageDocument,
  type PageFont,
  standardCatalogue,
  type StyleDeclarations,
} from "@lintel/builder-model";

/**
 * Small helpers for writing the reference layouts as builder documents, the way the
 * builder would store them after someone made them by hand: elements, styles per screen
 * size, free layouts and fonts. Nothing here is used by Lintel itself.
 */

/** Where the layouts' placeholder pictures are served from while they are rendered. */
export function media(file: string): string {
  return `/reference-media/${file}`;
}

export function catalogueFont(id: string): PageFont {
  return { source: "catalogue", id };
}

/** The `font-family` value for a catalogue font, as the font picker sets it. */
export function family(id: string): string {
  return fontFamilyValue(catalogueFont(id));
}

/** An element placed in a free layout: left and top in percent, then its own styles. */
export function placed(
  blueprint: NodeBlueprint,
  place: { left: number; top: number; width?: number; layer?: number },
  styles: Omit<NodeStyles, "base"> & { base?: StyleDeclarations } = {},
): NodeBlueprint {
  const { layer, ...position } = place;
  return {
    ...blueprint,
    styles: {
      ...styles,
      base: {
        ...freePlaceStyles(position),
        ...(layer !== undefined ? { zIndex: String(layer) } : {}),
        ...styles.base,
      },
    },
  };
}

export function referencePage(fonts: PageFont[], sections: NodeBlueprint[]): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds("ref");
  return {
    ...page,
    root: {
      ...page.root,
      props: { fonts },
      children: sections.map((section) => createNode(section, standardCatalogue, ids)),
    },
  };
}

/** A section with nothing around its content, so the design reaches every edge. */
export const edgeToEdge: StyleDeclarations = {
  paddingTop: "0",
  paddingRight: "0",
  paddingBottom: "0",
  paddingLeft: "0",
};
