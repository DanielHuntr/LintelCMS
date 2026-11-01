import {
  designBaseStylesheet,
  renderPage,
  standardRegistry,
  standInBaseStylesheet,
} from "@lintel/builder/render";
import { standardCatalogue, validatePageDocument } from "@lintel/builder-model";
import { defaultTheme, themeStylesheet } from "@lintel/site-components";
import siteStylesheet from "@lintel/site-components/styles.css?raw";
import { useEffect, useMemo, useState } from "react";
import { useCanvasSite } from "../website/website.queries.js";

/** The width the page is drawn at before it's scaled down: a laptop screen. */
const drawnWidth = 1280;
const drawnHeight = 800;

/**
 * A small, live picture of a page design: the page drawn with the website's own look and
 * header, scaled down to fit. Drawn by the same renderer as the builder's canvas and the
 * website, in a frame with no scripts. Decorative: the card around it says what it is.
 */
export function DesignThumbnail({ design }: { design: unknown }) {
  const canvasSite = useCanvasSite();
  const site = canvasSite.data;
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const scale = useScaleToFit(frame);

  const source = useMemo(() => {
    const checked = validatePageDocument(design, standardCatalogue);
    if (!checked.ok) return null;
    const page = renderPage(checked.document, standardRegistry);
    const css = site
      ? `${site.stylesheet}\n${page.css}`
      : `${themeStylesheet(defaultTheme)}\n${standInBaseStylesheet}\n${siteStylesheet}\n${designBaseStylesheet}\n${page.css}`;
    const base = site?.baseUrl ? `<base href="${escapeAttribute(site.baseUrl)}">` : "";
    const bodyClass = site ? ` class="${escapeAttribute(site.bodyClassName)}"` : "";
    return `<!doctype html><html><head><meta charset="utf-8">${base}<style>${css}</style></head><body${bodyClass}>${site?.headerHtml ?? ""}<main class="lintel-main"><div class="lintel-design">${page.html}</div></main></body></html>`;
  }, [design, site]);

  if (canvasSite.isPending || source === null) {
    return <div aria-hidden="true" className="size-full bg-fill" />;
  }
  return (
    <div
      ref={setFrame}
      aria-hidden="true"
      className="relative size-full overflow-hidden bg-surface"
    >
      <iframe
        title=""
        tabIndex={-1}
        srcDoc={source}
        sandbox=""
        loading="lazy"
        style={{
          width: drawnWidth,
          height: drawnHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="pointer-events-none absolute top-0 left-0 border-0"
      />
    </div>
  );
}

/** How much to shrink the drawn page so its width fits the frame. */
function useScaleToFit(element: HTMLElement | null) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / drawnWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return scale;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
