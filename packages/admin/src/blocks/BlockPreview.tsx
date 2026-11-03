import {
  designBaseStylesheet,
  renderPage,
  standardRegistry,
  standInBaseStylesheet,
} from "@lintel/builder/render";
import {
  type BoundPicture,
  createEmptyPage,
  type CustomBlock,
  customBlockType,
  type PageDocument,
} from "@lintel/builder-model";
import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import siteStylesheet from "@lintel/site-components/styles.css?raw";
import { useMemo, useState } from "react";
import { useCanvasSite } from "../website/website.queries.js";
import { pictureIdsInValues, useBlockPictures } from "./useBlockPictures.js";
import { useServerBlocks } from "./useServerBlocks.js";

const previewId = "preview";

/**
 * A live picture of one block with some values: drawn by the same renderer and stylesheet as
 * the builder's canvas and the website, in a frame without scripts that grows to fit. Used by
 * blocks fields and the block's own screen; loaded lazily, so the renderer stays out of the
 * admin's main bundle.
 */
export function BlockPreview({
  block,
  values,
  label,
}: {
  block: CustomBlock;
  values: Readonly<Record<string, unknown>>;
  label: string;
}) {
  const canvasSite = useCanvasSite();
  const site = canvasSite.data;
  const pictures = useBlockPictures(pictureIdsInValues(values, block.properties));
  const document = useMemo(() => previewDocument(block, values), [block, values]);
  const renderedBlocks = useServerBlocks(document.root, [block]);
  const [height, setHeight] = useState(160);

  const source = useMemo(
    () => previewSource(document, block, pictures, renderedBlocks, site),
    [document, block, pictures, renderedBlocks, site],
  );

  return (
    <iframe
      title={label}
      srcDoc={source}
      // Same origin, so its height can be read; no scripts run in it.
      sandbox="allow-same-origin"
      onLoad={(event) => {
        const body = event.currentTarget.contentDocument?.body;
        if (body) setHeight(Math.min(Math.max(body.scrollHeight, 80), 900));
      }}
      style={{ height }}
      className="w-full rounded-control border-0 bg-background hairline-ring"
    />
  );
}

function previewDocument(
  block: CustomBlock,
  values: Readonly<Record<string, unknown>>,
): PageDocument {
  const page = createEmptyPage();
  return {
    ...page,
    root: {
      ...page.root,
      children: [
        {
          id: previewId,
          type: customBlockType,
          name: block.name,
          props: { block: block.handle, values: { ...values } },
          styles: { base: {} },
          children: [],
          hidden: false,
          locked: false,
        },
      ],
    },
  };
}

function previewSource(
  document: PageDocument,
  block: CustomBlock,
  pictures: Record<string, BoundPicture>,
  renderedBlocks: Record<string, string> | undefined,
  site: ReturnType<typeof useCanvasSite>["data"],
): string {
  const page = renderPage(document, standardRegistry, {
    data: { blocks: { [block.handle]: block }, pictures, renderedBlocks },
  });
  const css = site
    ? `${site.stylesheet}\n${page.css}`
    : `${themeStylesheet(defaultTheme)}\n${standInBaseStylesheet}\n${siteStylesheet}\n${designBaseStylesheet}\n${page.css}`;
  const base = site?.baseUrl ? `<base href="${escapeAttribute(site.baseUrl)}">` : "";
  const bodyClass = site ? ` class="${escapeAttribute(site.bodyClassName)}"` : "";
  return `<!doctype html><html><head><meta charset="utf-8">${base}<style>${css}\nbody{margin:0;padding:16px;}</style></head><body${bodyClass}><div class="lintel-design">${page.html}</div></body></html>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
