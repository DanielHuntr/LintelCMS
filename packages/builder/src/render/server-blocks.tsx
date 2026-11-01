import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Blocks written in code as React components (`render: TeamCard` in a `.block.tsx` file, or
 * a plugin's block). The server draws them with the instance's properties and sends the HTML
 * with the page's data (`renderedBlocks`), so the website and the canvas show the same thing.
 * They should draw plain, semantic HTML styled with the theme's `--lintel-*` tokens, as the
 * site's own components do.
 */
export type BlockComponent<Properties = Record<string, unknown>> = (props: {
  properties: Properties;
}) => ReactNode;

export function renderBlockComponent<Properties>(
  component: BlockComponent<Properties>,
  properties: Properties,
): string {
  return renderToStaticMarkup(createElement(component, { properties }));
}
