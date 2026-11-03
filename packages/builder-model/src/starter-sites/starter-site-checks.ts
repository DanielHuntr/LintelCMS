import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createEmptyPage, type PageNode } from "../document/page-document.schema.js";
import { validatePageDocument } from "../document/validate-page.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { listNodes } from "../tree/tree-queries.js";
import { findIllustration } from "./illustrations.js";
import { buildStarterPage, type StarterPageOptions, type StarterSite } from "./starter-site.js";

/**
 * Plain checks a starter site should pass before it goes in the template library: every
 * page and its shared navigation and footer are designs the server accepts, headings go in
 * order with one main heading a page, pictures exist and say what they show, and no page
 * carries more effects than the builder's "a lot of effects" mark. Answers what's wrong, in
 * words; an empty list means all is well.
 */

const illustrationPattern = /^\/_lintel\/illustrations\/([a-z0-9-]+)\.svg$/;

/**
 * Whether an illustration's markup has a tag that sets the same attribute twice (two
 * fills, say), which browsers refuse to draw as an image.
 */
export function hasRepeatedAttribute(svg: string): boolean {
  return (svg.match(/<[^>]+>/g) ?? []).some((tag) => {
    const names = [...tag.matchAll(/\s([a-zA-Z:-]+)="/g)].map((match) => match[1]);
    return new Set(names).size !== names.length;
  });
}

/** The most effects a page of a template should carry (the builder warns past 12). */
export const starterEffectLimit = 10;

function checkPictures(where: string, nodes: readonly PageNode[]): string[] {
  const problems: string[] = [];
  for (const node of nodes) {
    const sources: string[] = [];
    if (node.type === "image") {
      sources.push(String(node.props.src));
      if (String(node.props.alt ?? "").length < 12) {
        problems.push(
          `${where}: the picture “${node.name}” needs alt text that says what it shows`,
        );
      }
    }
    for (const effect of node.effects ?? []) {
      if (effect.effect === "hover-picture") sources.push(String(effect.params.src));
    }
    for (const src of sources) {
      const name = illustrationPattern.exec(src)?.[1];
      const svg = name ? findIllustration(name) : undefined;
      if (!svg) problems.push(`${where}: no illustration at ${src}`);
      else if (hasRepeatedAttribute(svg)) problems.push(`${where}: ${src} won't draw`);
    }
  }
  return problems;
}

/** A shared section (navigation or footer) as the only element on a page, checked like one. */
function checkSharedSection(
  where: string,
  section: NodeBlueprint,
  catalogue: ComponentCatalogue,
): string[] {
  const empty = createEmptyPage();
  const design = {
    ...empty,
    root: { ...empty.root, children: [createNode(section, catalogue, createCountingNodeIds("s"))] },
  };
  const checked = validatePageDocument(design, catalogue);
  const problems = checked.ok
    ? []
    : checked.problems.map((problem) => `${where}: ${problem.message}`);
  const nodes = listNodes(design.root);
  if (nodes.some((node) => node.type === "heading")) {
    problems.push(`${where}: keep headings out of shared sections, so each page's order holds`);
  }
  return [...problems, ...checkPictures(where, nodes)];
}

export function checkStarterSite(
  site: StarterSite,
  catalogue: ComponentCatalogue,
  options: StarterPageOptions = { enabledPlugins: ["commerce", "forms"] },
): string[] {
  const problems: string[] = [];
  const cover = findIllustration(site.coverIllustration);
  if (!cover || hasRepeatedAttribute(cover)) {
    problems.push(`${site.id}: no cover illustration called ${site.coverIllustration} that draws`);
  }
  if (site.pages[0]?.slug !== "home") problems.push(`${site.id}: the first page should be home`);
  for (const page of site.pages) {
    const where = `${site.id}/${page.slug}`;
    const design = buildStarterPage(page, catalogue, createCountingNodeIds(), options);
    const checked = validatePageDocument(design, catalogue);
    if (!checked.ok) {
      problems.push(...checked.problems.map((problem) => `${where}: ${problem.message}`));
    }
    const nodes = listNodes(design.root);
    const headings = nodes.filter((node) => node.type === "heading");
    if (headings.filter((node) => node.props.level === 1).length !== 1) {
      problems.push(`${where}: a page needs exactly one main heading`);
    }
    let previous = 0;
    for (const node of headings) {
      const level = Number(node.props.level);
      if (level - previous > 1) {
        problems.push(`${where}: “${String(node.props.text)}” skips a heading level`);
      }
      previous = level;
    }
    if (!nodes.some((node) => node.animations?.length)) {
      problems.push(`${where}: nothing on the page moves`);
    }
    const effects = nodes.reduce((total, node) => total + (node.effects?.length ?? 0), 0);
    if (effects > starterEffectLimit) {
      problems.push(`${where}: ${effects} effects is more than ${starterEffectLimit}`);
    }
    const shared = nodes.filter((node) =>
      ["header", "footer"].includes(String(node.props.element)),
    );
    if (shared.length > 0) {
      problems.push(`${where}: the navigation and footer belong in the site's shared sections`);
    }
    problems.push(...checkPictures(where, nodes));
  }
  const sections = site.siteSections;
  if (sections?.navigation) {
    problems.push(...checkSharedSection(`${site.id} navigation`, sections.navigation, catalogue));
  }
  if (sections?.footer) {
    problems.push(...checkSharedSection(`${site.id} footer`, sections.footer, catalogue));
  }
  return problems;
}
