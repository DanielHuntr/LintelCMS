import {
  type BoundPicture,
  createEmptyPage,
  type CustomBlock,
  customBlockType,
  type PageDocument,
} from "@lintel/builder-model";
import type { PageView, SiteBlock } from "@lintel/site-components";
import { renderServerBlocks } from "../blocks/block-rendering.js";
import { loadBlockLibrary } from "../blocks/blocks.service.js";
import type { DeliveredEntry } from "../delivery/delivery.schema.js";
import { readBlocks } from "./delivered-to-site.js";
import { drawPageDesign } from "./designed-pages.js";
import { withPageLinkAddresses } from "./page-link-addresses.js";
import type { PageRequest } from "./site-pages.service.js";

/**
 * A page's sections (its blocks field) with the site's own blocks drawn in: each is drawn
 * by the builder's renderer exactly as it would be in a page design, so a block looks the
 * same in a blocks field and on a designed page. The other sections stay as they were.
 */
export async function withDesignedBlocks(
  request: PageRequest,
  entry: Pick<DeliveredEntry, "data">,
  view: PageView,
): Promise<PageView> {
  const items = sectionItems(entry.data);
  if (items.length === 0) return view;
  // "Choose a page" links in the blocks' designs are drawn as the pages' addresses.
  const library = await withPageLinkAddresses(
    request.dependencies.database,
    Object.fromEntries(
      (await loadBlockLibrary(request.dependencies.database)).map((block) => [block.handle, block]),
    ),
    request.locale,
  );
  if (!items.some((item) => library[item.type])) return view;

  const sections: SiteBlock[] = [];
  for (const item of items) {
    const block = library[item.type];
    if (!block) {
      sections.push(...readBlocks([item]));
      continue;
    }
    sections.push(await drawBlock(item, block, library));
  }
  return { ...view, sections };
}

interface SectionItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** The first of the fields pages keep their sections in, the same rule `toPageView` uses. */
function sectionItems(data: Readonly<Record<string, unknown>>): SectionItem[] {
  for (const handle of ["sections", "blocks"]) {
    const value = data[handle];
    if (!Array.isArray(value) || value.length === 0) continue;
    return value.flatMap((item): SectionItem[] => {
      if (typeof item !== "object" || item === null) return [];
      const { id, type, data: values } = item as Record<string, unknown>;
      return typeof id === "string" &&
        typeof type === "string" &&
        typeof values === "object" &&
        values
        ? [{ id, type, data: values as Record<string, unknown> }]
        : [];
    });
  }
  return [];
}

async function drawBlock(
  item: SectionItem,
  block: CustomBlock,
  library: Readonly<Record<string, CustomBlock>>,
): Promise<SiteBlock> {
  // Delivered values have pictures expanded; instances keep asset ids, with the pictures beside.
  const pictures: Record<string, BoundPicture> = {};
  const values: Record<string, unknown> = { ...item.data };
  for (const property of block.properties) {
    const value = item.data[property.handle];
    if (property.type === "image" && typeof value === "object" && value !== null) {
      const asset = value as {
        id?: unknown;
        url?: unknown;
        alt?: unknown;
        width?: unknown;
        height?: unknown;
      };
      if (typeof asset.id === "string" && typeof asset.url === "string") {
        values[property.handle] = asset.id;
        pictures[asset.id] = {
          src: asset.url,
          alt: typeof asset.alt === "string" ? asset.alt : "",
          width: typeof asset.width === "number" ? asset.width : null,
          height: typeof asset.height === "number" ? asset.height : null,
        };
      }
    }
  }
  const page = createEmptyPage();
  const document: PageDocument = {
    ...page,
    root: {
      ...page.root,
      children: [
        {
          id: item.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "block",
          type: customBlockType,
          name: block.name,
          props: { block: block.handle, values },
          styles: { base: {} },
          children: [],
          hidden: false,
          locked: false,
        },
      ],
    },
  };
  const instance = document.root.children[0];
  const renderedBlocks = await renderServerBlocks(
    instance ? [{ id: instance.id, block: block.handle, values }] : [],
    library,
    undefined,
    pictures,
  );
  const { html, css } = drawPageDesign(document, { blocks: library, pictures, renderedBlocks });
  return { type: "design", id: item.id, html, css };
}
