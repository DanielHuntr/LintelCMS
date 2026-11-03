import {
  type AnyComponentDefinition,
  type ComponentCatalogue,
  type ComponentDefinition,
  createComponentCatalogue,
  type PageNode,
} from "@lintel/builder-model";
import type { ComponentType, ReactNode } from "react";

/**
 * The components the builder can place, each a definition (from `@lintel/builder-model`)
 * paired with how it draws: a React component that is safe to render on the server, takes
 * plain props and prints clean, semantic HTML with the class it is given.
 *
 * The stand-in drawings in stand-in-components.tsx are swapped for `@lintel/site-components`
 * by passing those to `createComponentRegistry` instead; nothing else changes.
 */

/** What every element's drawing is given. */
export interface RenderProps<Props = Record<string, unknown>> {
  /** Checked by the component's schema, with defaults filled in. */
  props: Props;
  children: ReactNode;
  node: PageNode;
  /** Goes on the element's outermost tag: its class and, on the canvas, its node id. */
  attributes: ElementAttributes;
  /** Goes on the tag holding a prop's text, so the canvas can edit it in place. */
  editableText: (prop: string) => Record<string, string>;
  /** "canvas" while editing, "site" for the published page. */
  mode: RenderMode;
}

export type RenderMode = "site" | "canvas";

export interface ElementAttributes {
  className: string;
  "data-lintel-node"?: string;
  /** On the published page, only on animated elements: how the motion runtime finds them. */
  "data-node-id"?: string;
  /** Entrances start hidden until their animation is ready (see `motionCloakCss`). */
  "data-motion-cloak"?: "";
  /** On the published page: it opens and closes, its button toggling it (open states). */
  "data-lintel-opens"?: "";
  /** On the canvas only: a free layout, whose children can be dragged anywhere in it. */
  "data-lintel-free"?: "stack-on-phone" | "free";
}

export type ComponentRender = ComponentType<RenderProps>;

export interface ComponentRegistryEntry {
  definition: AnyComponentDefinition;
  Render: ComponentRender;
}

export interface ComponentRegistry {
  catalogue: ComponentCatalogue;
  find(type: string): ComponentRegistryEntry | undefined;
}

export class MissingRenderError extends Error {
  constructor(type: string) {
    super(`The “${type}” component has no drawing. Pass one to createComponentRegistry.`);
    this.name = "MissingRenderError";
  }
}

/** Pairs each definition with its drawing. Every definition needs one. */
export function createComponentRegistry(
  definitions: readonly AnyComponentDefinition[],
  renders: Readonly<Record<string, ComponentRender>>,
): ComponentRegistry {
  const catalogue = createComponentCatalogue(definitions);
  const entries = new Map<string, ComponentRegistryEntry>();
  for (const definition of definitions) {
    const Render = renders[definition.type];
    if (!Render) throw new MissingRenderError(definition.type);
    entries.set(definition.type, { definition, Render });
  }
  return { catalogue, find: (type) => entries.get(type) };
}

/**
 * Lets a drawing declare the props type its definition guarantees, while the registry keeps
 * one shape for all of them. The props were checked by the definition's schema first.
 */
export function drawsProps<Props extends Record<string, unknown>>(
  _definition: ComponentDefinition<Props>,
  Render: ComponentType<RenderProps<Props>>,
): ComponentRender {
  return Render as unknown as ComponentRender;
}
