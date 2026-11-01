// Run by dev-runtime.test.ts through tsx exactly as `pnpm dev` runs Lintel: workspace
// packages resolve to their TypeScript sources, so this compiles the builder's .tsx files.
import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findSectionTemplate,
  standardCatalogue,
} from "@lintel/builder-model";
import { renderPage, standardRegistry } from "@lintel/builder/render";

const page = createEmptyPage();
const hero = createNode(
  findSectionTemplate("hero")!.blueprint,
  standardCatalogue,
  createCountingNodeIds(),
);
const { html } = renderPage(
  { ...page, root: { ...page.root, children: [hero] } },
  standardRegistry,
);
process.stdout.write(html.length > 0 ? "rendered" : "empty");
