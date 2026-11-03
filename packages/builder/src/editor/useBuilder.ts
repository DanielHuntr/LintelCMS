import {
  type BackgroundVideo,
  type NodeBlueprint,
  type DesignVariable,
  type SharedStyle,
  buildStarterPage,
  type CreateNodeId,
  type FreeLayout,
  type Breakpoint,
  type FreePlace,
  type GridPlace,
  type PlacedGrid,
  type MarkChange,
  type PageFont,
  type StackingMove,
  type NodeAnimation,
  type NodeEffect,
  type StateTransition,
  createNode,
  findNode,
  findPath,
  findSectionTemplate,
  importHtml,
  listNodes,
  type PageDocument,
  type PageNode,
  rootNodeId,
  type StarterPage,
  type StylePropertyName,
  type StyleTarget,
  type CustomBlock,
  detachBlockInstance,
  instanceBlockHandle,
  type BoundPicture,
  type SiteSectionSlot,
  withMenuLinks,
  type ClientContentKind,
} from "@lintel/builder-model";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Translate } from "../i18n/builder-text.js";
import type { InsertKey } from "../panels/InsertPanel.js";
import type { ComponentRegistry } from "../render/component-registry.js";
import { renderPage } from "../render/render-page.js";
import { type BuilderClipboard, choosePasteSource, writeToSystemClipboard } from "./clipboard.js";
import { instanceBlueprint } from "../blocks/block-commands.js";
import * as commands from "./commands.js";
import * as designCommands from "./design-commands.js";
import { insertDraftedSections } from "./draft-commands.js";
import * as siteSectionCommands from "./site-section-commands.js";
import { createEditorState, describeUndo, editorReducer } from "./editor-state.js";

type StyleValues = Partial<Record<StylePropertyName, string | undefined>>;

const noBlockLibrary: readonly CustomBlock[] = [];

interface UseBuilderOptions {
  initialDocument: PageDocument;
  /** The site's own blocks, for inserting and detaching instances. */
  blocks?: readonly CustomBlock[];
  registry: ComponentRegistry;
  createId: CreateNodeId;
  canEditCode: boolean;
  text: Translate;
  onChange: (document: PageDocument) => void;
  /**
   * Sections from the Navigation and Footer groups go on every page of the site (see
   * site-sections/ in the model). Off, they're added to this page like any other.
   */
  sharesSiteSections?: boolean;
}

/**
 * The builder's brain: the page with its history and selection, every action the panels and
 * shortcuts can take, and the sentence to announce after each one (what happened, or why it
 * couldn't).
 */
export function useBuilder({
  initialDocument,
  registry,
  createId,
  canEditCode,
  text,
  onChange,
  blocks = noBlockLibrary,
  sharesSiteSections = false,
}: UseBuilderOptions) {
  // Menus made before they had a Menu link get one, so it shows in Layers. It's saved with
  // the next change; until then the page is as it was.
  const [state, dispatch] = useReducer(editorReducer, initialDocument, (document) =>
    createEditorState(withMenuLinksIn(document, createId)),
  );
  const [announcement, setAnnouncement] = useState({ message: "", count: 0 });
  const clipboard = useRef<BuilderClipboard | null>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });

  const announce = useCallback(
    (message: string) => setAnnouncement((current) => ({ message, count: current.count + 1 })),
    [],
  );

  const lastSent = useRef(state.document);
  useEffect(() => {
    if (state.document === lastSent.current) return;
    lastSent.current = state.document;
    onChange(state.document);
  }, [state.document, onChange]);

  const selectedNode = state.selectedId
    ? findNode(state.document.root, state.selectedId)
    : undefined;
  const selectedId = selectedNode && selectedNode.id !== rootNodeId ? selectedNode.id : null;

  const context = useCallback(
    (): commands.CommandContext => ({
      document: latest.current.document,
      selectedId: latest.current.selectedId,
      catalogue: registry.catalogue,
      createId,
      text,
    }),
    [registry, createId, text],
  );

  const run = useCallback(
    (result: commands.CommandResult, announceAs?: string) => {
      if ("refused" in result) {
        announce(result.refused);
        return false;
      }
      dispatch({ type: "change", change: result.change, at: Date.now() });
      // Typing and sliders change things many times a second; only discrete changes are spoken.
      if (announceAs !== "") announce(announceAs ?? result.change.label);
      return true;
    },
    [announce],
  );

  const actions = useMemo(() => {
    const name = (node: PageNode) => commands.layerName(node, registry.catalogue);
    const nodeById = (nodeId: string) => findNode(latest.current.document.root, nodeId);
    const select = (nodeId: string | null) => dispatch({ type: "select", nodeId });

    const insert = (key: InsertKey, place?: { parentId: string; index: number }) => {
      const [kind, id] = key.split(":") as ["component" | "template" | "block", string];
      const template = kind === "template" ? findSectionTemplate(id) : undefined;
      if (
        sharesSiteSections &&
        template &&
        (template.category === "navigation" || template.category === "footer")
      ) {
        return run(
          siteSectionCommands.insertSiteSection(context(), template.category, template.blueprint),
        );
      }
      const block = kind === "block" ? blocks.find((candidate) => candidate.handle === id) : null;
      const blueprint =
        kind === "template"
          ? findSectionTemplate(id)?.blueprint
          : kind === "block"
            ? block && instanceBlueprint(block)
            : { type: id };
      if (!blueprint) return;
      if (!place) return run(commands.insertBlueprint(context(), blueprint));
      const node = createNode(blueprint, registry.catalogue, createId);
      return run(
        commands.insertNodes(
          context(),
          [node],
          place,
          text("pageBuilder.history.added", { name: name(node) }),
        ),
      );
    };

    const pasteNodes = (nodes: PageNode[], label: string) => {
      const first = nodes[0];
      const place = first ? commands.findInsertPlace(context(), first.type) : null;
      if (!place) return announce(text("pageBuilder.refused.nothingToPaste"));
      run(commands.insertNodes(context(), nodes, place, label));
    };

    const importAndPaste = (html: string) => {
      const imported = importHtml(html, {
        catalogue: registry.catalogue,
        createId,
        allowCode: canEditCode,
      });
      if (imported.nodes.length === 0) return announce(text("pageBuilder.paste.nothingUsable"));
      pasteNodes(
        imported.nodes,
        text("pageBuilder.history.pasted", { count: imported.nodes.length }),
      );
      if (imported.skipped > 0)
        announce(text("pageBuilder.paste.someLeftOut", { count: imported.skipped }));
    };

    const copySelected = async (andRemove: boolean) => {
      const node = latest.current.selectedId ? nodeById(latest.current.selectedId) : undefined;
      if (!node || node.id === rootNodeId)
        return announce(text("pageBuilder.refused.nothingSelected"));
      const { html } = renderPage(latest.current.document, registry, { nodeId: node.id });
      clipboard.current = { nodes: [node], systemText: null };
      if (andRemove)
        run(
          commands.removeSelected(context()),
          text("pageBuilder.history.cut", { name: name(node) }),
        );
      else announce(text("pageBuilder.clipboard.copied", { name: name(node) }));
      const wrote = await writeToSystemClipboard(html);
      if (clipboard.current?.nodes[0] === node)
        clipboard.current = { nodes: [node], systemText: wrote ? html : null };
    };

    const adjacent = (step: number) => {
      const nodes = listNodes(latest.current.document.root).filter(
        (node) => node.id !== rootNodeId,
      );
      const index = nodes.findIndex((node) => node.id === latest.current.selectedId);
      const next = nodes[index === -1 ? (step > 0 ? 0 : nodes.length - 1) : index + step];
      if (next) {
        select(next.id);
        announce(name(next));
      }
    };

    return {
      select,
      insert,
      undo: () => {
        const { undo } = describeUndo(latest.current);
        dispatch({ type: "undo" });
        announce(
          undo
            ? text("pageBuilder.history.undid", { name: undo })
            : text("pageBuilder.history.nothingToUndo"),
        );
      },
      redo: () => {
        const { redo } = describeUndo(latest.current);
        dispatch({ type: "redo" });
        announce(
          redo
            ? text("pageBuilder.history.redid", { name: redo })
            : text("pageBuilder.history.nothingToRedo"),
        );
      },
      goToStep: (index: number) => dispatch({ type: "goToStep", index }),
      remove: () => run(commands.removeSelected(context())),
      duplicate: () => run(commands.duplicateSelected(context())),
      /** Removes or copies this element, whatever is selected (a client's list items). */
      removeById: (nodeId: string) =>
        run(commands.removeSelected({ ...context(), selectedId: nodeId })),
      duplicateById: (nodeId: string) =>
        run(commands.duplicateSelected({ ...context(), selectedId: nodeId })),
      move: (direction: commands.MoveDirection) => run(commands.moveSelected(context(), direction)),
      moveTo: (nodeId: string, parentId: string, index: number) =>
        run(commands.moveTo(context(), nodeId, parentId, index)),
      toggleHidden: (nodeId: string) => {
        const node = nodeById(nodeId);
        if (!node) return;
        const label = text(
          node.hidden ? "pageBuilder.history.shown" : "pageBuilder.history.hidden",
          { name: name(node) },
        );
        run(
          commands.changeNode(context(), nodeId, label, (current) => ({
            ...current,
            hidden: !current.hidden,
          })),
        );
      },
      toggleLocked: (nodeId: string) => {
        const node = nodeById(nodeId);
        if (!node) return;
        const label = text(
          node.locked ? "pageBuilder.history.unlocked" : "pageBuilder.history.locked",
          { name: name(node) },
        );
        run(
          commands.changeNode(
            context(),
            nodeId,
            label,
            (current) => ({ ...current, locked: !current.locked }),
            { evenIfLocked: true },
          ),
        );
      },
      rename: (nodeId: string, newName: string) => {
        const node = nodeById(nodeId);
        if (!node || node.name === newName) return;
        run(
          commands.changeNode(
            context(),
            nodeId,
            text("pageBuilder.history.renamed", { name: newName || name({ ...node, name: "" }) }),
            (current) => ({ ...current, name: newName }),
          ),
        );
      },
      /** What clients may change here (see client-editing/ in the model); undefined clears it. */
      setClientAccess: (
        nodeId: string,
        access: { clientEdits?: ClientContentKind[] | null; clientRepeats?: boolean },
      ) => {
        const node = nodeById(nodeId);
        if (!node) return;
        run(
          commands.changeNode(
            context(),
            nodeId,
            text("pageBuilder.clientAccess.history", { name: name(node) }),
            (current) => {
              const next = { ...current };
              if (access.clientEdits === null) delete next.clientEdits;
              else if (access.clientEdits) next.clientEdits = access.clientEdits;
              if (access.clientRepeats === false) delete next.clientRepeats;
              else if (access.clientRepeats) next.clientRepeats = true;
              return next;
            },
            { evenIfLocked: true },
          ),
        );
      },
      changeProps: (nodeId: string, props: Record<string, unknown>, label: string) =>
        run(commands.changeProps(context(), nodeId, props, label), ""),
      changeBinding: (nodeId: string, prop: string, fieldPath: string | null, label: string) =>
        run(commands.changeBinding(context(), nodeId, prop, fieldPath, label), ""),
      changeStyles: (nodeId: string, target: StyleTarget, values: StyleValues, label: string) =>
        run(commands.changeStyles(context(), nodeId, target, values, label), ""),
      editText: (nodeId: string, prop: string, value: string) => {
        const node = nodeById(nodeId);
        if (node && node.props[prop] !== value) {
          run(commands.changeProps(context(), nodeId, { [prop]: value }, name(node)));
        }
      },
      setFreeLayout: (nodeId: string, freeLayout: FreeLayout | null) =>
        run(designCommands.setFreeLayout(context(), nodeId, freeLayout)),
      placeFreely: (nodeId: string, target: StyleTarget, place: FreePlace) => {
        const node = nodeById(nodeId);
        if (!node) return;
        run(
          designCommands.placeFreely(
            context(),
            nodeId,
            target,
            place,
            text("pageBuilder.design.history.moved", { name: name(node) }),
          ),
        );
      },
      setPlacedGrid: (nodeId: string, placedGrid: PlacedGrid | null) =>
        run(designCommands.setPlacedGrid(context(), nodeId, placedGrid)),
      placeOnGrid: (nodeId: string, target: Breakpoint, place: GridPlace) => {
        const node = nodeById(nodeId);
        if (!node) return;
        run(
          designCommands.placeOnGrid(
            context(),
            nodeId,
            target,
            place,
            text("pageBuilder.design.history.moved", { name: name(node) }),
          ),
        );
      },
      changeSharedStyle: (nodeId: string, change: designCommands.SharedStyleChange) =>
        run(designCommands.changeSharedStyle(context(), nodeId, change)),
      /** Before a site variable goes: this page's elements keep its value as their own. */
      writeOutVariable: (variable: DesignVariable) => {
        const result = designCommands.writeOutVariable(context(), variable);
        if (result) run(result);
      },
      /** Before a shared style goes: this page's elements keep its look as their own. */
      detachEverything: (
        sharedStyle: SharedStyle,
        looks: Readonly<Record<string, SharedStyle>>,
      ) => {
        const result = designCommands.detachEverything(context(), sharedStyle, looks);
        if (result) run(result);
      },
      restack: (nodeId: string, move: StackingMove) =>
        run(designCommands.restackNode(context(), nodeId, move)),
      setBackgroundVideo: (nodeId: string, video: BackgroundVideo | null) =>
        run(designCommands.setBackgroundVideo(context(), nodeId, video)),
      changePageFonts: (fonts: PageFont[], label: string) =>
        run(designCommands.changePageFonts(context(), fonts, label)),
      /**
       * Styles part of a text, or with `styles` null clears it. `text` is the text as shown
       * when it was selected; if it was typed into and not saved yet, it is saved first.
       */
      markText: (
        selection: { nodeId: string; prop: string; from: number; to: number; text: string },
        styles: MarkChange | null,
        label: string,
      ) => {
        const node = nodeById(selection.nodeId);
        if (!node) return;
        if (node.props[selection.prop] !== selection.text) {
          run(
            commands.changeProps(
              context(),
              node.id,
              { [selection.prop]: selection.text },
              name(node),
            ),
            "",
          );
        }
        run(
          designCommands.markText(
            context(),
            node.id,
            {
              from: Math.min(selection.from, selection.to),
              to: Math.max(selection.from, selection.to),
            },
            styles,
            label,
          ),
        );
      },
      copy: () => void copySelected(false),
      cut: () => void copySelected(true),
      paste: (pasted: { html: string; text: string }) => {
        const source = choosePasteSource(clipboard.current, pasted);
        if (source.kind === "builder")
          pasteNodes(
            source.nodes,
            text("pageBuilder.history.pasted", { count: source.nodes.length }),
          );
        else if (source.kind === "html") importAndPaste(source.html);
      },
      changeCode: (nodeId: string, code: { html: string; css: string; js: string }) =>
        run(
          commands.changeNode(
            context(),
            nodeId,
            text("pageBuilder.history.changedCode"),
            (node) => ({ ...node, props: { ...node.props, ...code } }),
          ),
        ),
      animate: (nodeId: string, animations: NodeAnimation[]) =>
        run(
          commands.changeAnimations(context(), nodeId, animations),
          animations.length > 0 ? "" : undefined,
        ),
      setEffects: (nodeId: string, effects: NodeEffect[]) =>
        run(commands.changeEffects(context(), nodeId, effects), ""),
      setStateTransition: (nodeId: string, transition: StateTransition | null) =>
        run(commands.changeStateTransition(context(), nodeId, transition), ""),
      /** Drafted sections, added as one change (see src/page-drafts). */
      insertDraftedSections: (blueprints: readonly NodeBlueprint[], label: string) =>
        run(insertDraftedSections(context(), blueprints, label)),
      useStarterPage: (page: StarterPage, name: string) =>
        run(
          commands.replacePageContent(
            context(),
            buildStarterPage(page, registry.catalogue, createId),
            text("pageBuilder.history.usedTemplatePage", { name }),
          ),
        ),
      /** Puts an instance of a block just made from the element where the element was. */
      replaceWithBlock: (nodeId: string, block: CustomBlock) => {
        const node = nodeById(nodeId);
        if (!node) return;
        const instance = createNode(instanceBlueprint(block), registry.catalogue, createId);
        run(
          commands.replaceNode(
            context(),
            nodeId,
            instance,
            text("pageBuilder.history.madeBlock", { name: block.name }),
          ),
        );
      },
      /** Turns an instance into the plain elements its design is, with its values typed in. */
      detachBlock: (nodeId: string, pictures?: Readonly<Record<string, BoundPicture>>) => {
        const node = nodeById(nodeId);
        const handle = node ? instanceBlockHandle(node) : null;
        const block = blocks.find((candidate) => candidate.handle === handle);
        const plain = node && block ? detachBlockInstance(node, block, createId, pictures) : null;
        if (!node || !block || !plain) return;
        run(
          commands.replaceNode(
            context(),
            nodeId,
            plain,
            text("pageBuilder.history.detachedBlock", { name: block.name }),
          ),
        );
      },
      changeBlockValues: (nodeId: string, values: Record<string, unknown>, blockName: string) =>
        run(
          commands.changeNode(
            context(),
            nodeId,
            text("pageBuilder.history.changedBlockValues", { name: blockName }),
            (node) => ({ ...node, props: { ...node.props, values } }),
            { coalesceKey: `block-values:${nodeId}` },
          ),
          "",
        ),
      /** In a block's design: the design with new bindings, from "Choose what editors can change". */
      replaceDesign: (nodeId: string, design: PageNode) =>
        run(
          commands.changeNode(
            context(),
            nodeId,
            text("pageBuilder.history.remappedBlock"),
            () => design,
          ),
        ),
      useAsSiteSection: (nodeId: string, slot: SiteSectionSlot) =>
        run(siteSectionCommands.useAsSiteSection(context(), nodeId, slot)),
      markAsPageOwn: (nodeId: string, slot: SiteSectionSlot) =>
        run(siteSectionCommands.markAsPageOwn(context(), nodeId, slot)),
      setSiteSectionHidden: (slot: SiteSectionSlot, hidden: boolean) =>
        run(siteSectionCommands.setSiteSectionHidden(context(), slot, hidden)),
      removeSiteSectionFromSite: (slot: SiteSectionSlot) =>
        run(siteSectionCommands.removeSiteSectionFromSite(context(), slot)),
      selectAdjacent: adjacent,
      selectParent: () => {
        const selected = latest.current.selectedId;
        const path = selected ? findPath(latest.current.document.root, selected) : [];
        const parent = path.at(-2);
        select(parent && parent.id !== rootNodeId ? parent.id : null);
      },
    };
  }, [registry, createId, canEditCode, text, context, run, announce, blocks, sharesSiteSections]);

  return {
    state,
    selectedId,
    selectedNode: selectedId ? selectedNode : undefined,
    actions,
    announcement,
    announce,
  };
}

function withMenuLinksIn(document: PageDocument, createId: CreateNodeId): PageDocument {
  const root = withMenuLinks(document.root, createId);
  return root === document.root ? document : { ...document, root };
}
