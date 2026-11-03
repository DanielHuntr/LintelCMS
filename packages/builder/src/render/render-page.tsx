import {
  type AnyComponentDefinition,
  assignClassNames,
  bindProps,
  compileStylesheet,
  expandBlockInstances,
  findNode,
  fontPreloads,
  listOpeningNodes,
  type PageData,
  type PageDocument,
  type PageNode,
  readPageFonts,
} from "@lintel/builder-model";
import type { ReactElement } from "react";
import { BackgroundVideo, backgroundVideoScript, hasBackgroundVideo } from "./background-video.js";
import { PageDataProvider, useCurrentItem, useIsRepeatedCopy } from "./data-context.js";
import { usesBehaviours } from "./elements/behaviour-types.js";
import { renderToStaticMarkup } from "react-dom/server";
import { collectAnimations, type PageAnimation } from "./page-animations.js";
import { collectEffects, usesMotionApi } from "./page-effects.js";
import type { EffectBinding } from "@lintel/motion/effects";
import type { ComponentRegistry, ElementAttributes, RenderMode } from "./component-registry.js";

/**
 * Turns a page design into HTML and a stylesheet: the same function draws the editor's canvas
 * and the published page, so what people see while editing is what visitors get.
 *
 *   const { html, css } = renderPage(page, standardRegistry);
 *
 * The HTML has one class per element and nothing else, unless `mode` is "canvas", which adds
 * `data-lintel-node` (and `data-lintel-text` on editable text) for selecting and editing. On
 * the published page (`withMotion`), animated elements also get `data-node-id`, so the motion
 * runtime can find them; `animations` lists what to play, and is empty when nothing moves.
 * Elements with effects are marked the same way, and `effects` lists them for the effects
 * runtime; an effect's static CSS (a fallback colour, a flip card's layout) joins the CSS.
 * The CSS uses the theme's tokens (`var(--lintel-color-brand)`); put the theme's stylesheet
 * before it. The output only depends on the page, so the same page always gives the same text.
 *
 * `fontPreloads` are the font files worth `<link rel="preload">`ing, and `script` is the small
 * script background videos need (empty when there are none); the website puts both in the head.
 */

export interface RenderOptions {
  mode?: RenderMode;
  /** Draw only this element and what's inside it, as the code view does. */
  nodeId?: string;
  /**
   * Mark animated elements for the motion runtime (`data-node-id`, and the cloak on
   * entrances). The website turns this on; the code view and the clipboard leave it off.
   */
  withMotion?: boolean;
  /**
   * What dynamic elements show: collection lists' entries, products, the site's menu. The
   * website loads it for each page; the canvas passes samples.
   */
  data?: PageData;
}

export interface RenderedPage {
  html: string;
  css: string;
  animations: PageAnimation[];
  /** Effects from the Effects library the page runs; empty when it has none. */
  effects: EffectBinding[];
  /** A code block uses `window.lintelMotion`, so the page needs the runtime. */
  usesMotionApi: boolean;
  fontPreloads: string[];
  script: string;
  /** The page has sliders, tabs, pop-ups or the like, so it needs the elements script. */
  usesBehaviours: boolean;
}

export function renderPage(
  document: PageDocument,
  registry: ComponentRegistry,
  { mode = "site", nodeId, withMotion = false, data = {} }: RenderOptions = {},
): RenderedPage {
  // The site's own blocks are drawn as their design, filled in (see custom-blocks/ in the model).
  const root = expandBlockInstances(document.root, data);
  const classNames = assignClassNames(root, registry.catalogue);
  const start = nodeId ? findNode(root, nodeId) : root;
  if (!start || start.hidden) {
    return {
      html: "",
      css: "",
      animations: [],
      effects: [],
      usesMotionApi: false,
      fontPreloads: [],
      script: "",
      usesBehaviours: false,
    };
  }
  const animations = collectAnimations(start);
  const effects = collectEffects(start, { canvas: mode === "canvas" });
  const marked =
    mode === "site" && withMotion
      ? motionMarks(animations, effects.bindings)
      : new Map<string, ElementAttributes>();
  // Elements with an open state are marked on the website, so their button can toggle them.
  const opening = listOpeningNodes(start);
  if (mode === "site") {
    for (const nodeId of opening) {
      marked.set(nodeId, { className: "", ...marked.get(nodeId), "data-lintel-opens": "" });
    }
  }
  const html = renderToStaticMarkup(
    <PageDataProvider data={data}>
      <NodeView
        node={start}
        registry={registry}
        classNames={classNames}
        mode={mode}
        motionMarks={marked}
      />
    </PageDataProvider>,
  );
  const isWholePage = start.id === root.id;
  return {
    html,
    css: [compileStylesheet(start, classNames), effects.css].filter(Boolean).join("\n"),
    animations,
    effects: effects.bindings,
    usesMotionApi: mode === "site" && usesMotionApi(start),
    fontPreloads: isWholePage ? fontPreloads(readPageFonts(document.root.props)) : [],
    script: mode === "site" && hasBackgroundVideo(start) ? backgroundVideoScript : "",
    usesBehaviours: usesBehaviours(start) || opening.size > 0,
  };
}

/**
 * Props checked against the component's schema, remembered per props object. Unchanged
 * nodes keep their props object between versions of the page, so redrawing the canvas after
 * a change only checks what changed.
 */
const checkedPropsCache = new WeakMap<object, Record<string, unknown>>();

function checkedProps(node: PageNode, definition: AnyComponentDefinition): Record<string, unknown> {
  const cached = checkedPropsCache.get(node.props);
  if (cached) return cached;
  const parsed = definition.propsSchema.safeParse(node.props);
  const props = parsed.success ? parsed.data : definition.defaultProps;
  checkedPropsCache.set(node.props, props);
  return props;
}

/**
 * Props with the current entry's fields in the bound ones, checked again, since an entry's
 * value (a long title) may not fit what the element accepts: then the typed props are used.
 */
function boundProps(
  node: PageNode,
  definition: AnyComponentDefinition,
  item: Parameters<typeof bindProps>[2],
): Record<string, unknown> {
  const typed = checkedProps(node, definition);
  const parsed = definition.propsSchema.safeParse(bindProps(typed, node.bindings, item));
  return parsed.success ? parsed.data : typed;
}

/**
 * The attributes the motion runtime needs on the published page: `data-node-id` on every
 * animated element and every element an animation points at, and the cloak on entrances.
 */
function motionMarks(
  animations: readonly PageAnimation[],
  effects: readonly EffectBinding[],
): Map<string, ElementAttributes> {
  const marks = new Map<string, ElementAttributes>();
  const mark = (nodeId: string, cloak: boolean) => {
    const current = marks.get(nodeId);
    marks.set(nodeId, {
      className: "",
      "data-node-id": nodeId,
      ...(cloak || current?.["data-motion-cloak"] === "" ? { "data-motion-cloak": "" } : {}),
    });
  };
  for (const { nodeId, spec } of animations) {
    mark(nodeId, spec.trigger.type === "load" || spec.trigger.type === "inView");
    if (spec.targets.type === "nodes")
      spec.targets.nodeIds.forEach((target) => mark(target, false));
    // A scene step finds the element it follows by its id, so that one carries it too.
    if (spec.trigger.type === "scroll" && spec.trigger.follows) mark(spec.trigger.follows, false);
  }
  effects.forEach(({ nodeId }) => mark(nodeId, false));
  return marks;
}

interface NodeViewProps {
  node: PageNode;
  registry: ComponentRegistry;
  classNames: ReadonlyMap<string, string>;
  mode: RenderMode;
  motionMarks: ReadonlyMap<string, ElementAttributes>;
}

function NodeView({
  node,
  registry,
  classNames,
  mode,
  motionMarks,
}: NodeViewProps): ReactElement | null {
  const item = useCurrentItem();
  const isCopy = useIsRepeatedCopy();
  if (node.hidden) return null;
  const className = classNames.get(node.id) ?? node.type;
  const entry = registry.find(node.type);
  if (!entry) {
    return mode === "canvas" ? (
      <div className={className} data-lintel-node={node.id} data-lintel-placeholder="unknown" />
    ) : null;
  }
  const props =
    node.bindings && item
      ? boundProps(node, entry.definition, item)
      : checkedProps(node, entry.definition);
  const { Render } = entry;
  const motion = motionMarks.get(node.id);
  const isSelectable = mode === "canvas" && !isCopy;
  const attributes: ElementAttributes = isSelectable
    ? { className, "data-lintel-node": node.id, ...freeLayoutMark(node) }
    : mode === "canvas"
      ? { className }
      : { ...motion, className };
  return (
    <Render
      props={props}
      node={node}
      mode={mode}
      attributes={attributes}
      editableText={(prop): Record<string, string> =>
        isSelectable && !node.bindings?.[prop] ? { "data-lintel-text": prop } : {}
      }
    >
      {node.backgroundVideo && <BackgroundVideo video={node.backgroundVideo} mode={mode} />}
      {node.children.map((child) => (
        <NodeView
          key={child.id}
          node={child}
          registry={registry}
          classNames={classNames}
          mode={mode}
          motionMarks={motionMarks}
        />
      ))}
    </Render>
  );
}

function freeLayoutMark(node: PageNode): Pick<ElementAttributes, "data-lintel-free"> {
  if (!node.freeLayout) return {};
  return { "data-lintel-free": node.freeLayout.stackOnPhone ? "stack-on-phone" : "free" };
}
