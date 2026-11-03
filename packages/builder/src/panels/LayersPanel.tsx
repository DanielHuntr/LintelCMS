import {
  type ComponentCatalogue,
  findPath,
  listVisibleRows,
  type PageNode,
} from "@lintel/builder-model";
import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { layerName } from "../editor/commands.js";
import { useBuilderText } from "../i18n/builder-text.js";
import {
  type DropPosition,
  dropPlace,
  dropPositionAt,
  insertDragType,
  layerDragType,
} from "./layer-drop.js";
import { LayerRow } from "./LayerRow.js";

export interface LayersPanelProps {
  root: PageNode;
  catalogue: ComponentCatalogue;
  selectedId: string | null;
  onSelect: (nodeId: string | null) => void;
  /** Every selected layer, when several are (the first is `selectedId`). */
  selectedIds?: readonly string[];
  /**
   * Selecting several: Ctrl/Cmd-click adds or takes away, Shift-click a range, Ctrl/Cmd+A
   * everything beside it, Shift+Up and Down extend. Left out, clicks select one.
   */
  onSelectWith?: (nodeId: string, how: LayerSelectHow) => void;
  onHover: (nodeId: string | null) => void;
  onToggleHidden: (nodeId: string) => void;
  onToggleLocked: (nodeId: string) => void;
  onRename: (nodeId: string, name: string) => void;
  onMove: (nodeId: string, parentId: string, index: number) => void;
  /** Something dragged in from the Insert panel: its key, and where it was dropped. */
  onInsertAt: (insertKey: string, parentId: string, index: number) => void;
}

/**
 * The page as a tree (the ARIA tree pattern). Up and Down move through the layers and select
 * them, Right and Left open and close them, Home and End jump to the ends, Enter or F2
 * renames. Dragging a row moves the layer; the global shortcuts (Alt+arrows to move, Delete,
 * Cmd+D...) act on the selected layer, so they work here too.
 */
export type LayerSelectHow = "toggle" | "range" | "siblings" | "extendNext" | "extendPrevious";

export function LayersPanel(props: LayersPanelProps) {
  const text = useBuilderText();
  const { root, catalogue, selectedId } = props;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ nodeId: string; position: DropPosition } | null>(null);
  const dragged = useRef<{ nodeId: string | null; type: string } | null>(null);
  const tree = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // A selected layer is never hidden inside a closed parent.
  const ancestorsOfSelected = useMemo(
    () =>
      selectedId
        ? findPath(root, selectedId)
            .slice(0, -1)
            .map((node) => node.id)
        : [],
    [root, selectedId],
  );
  const visibleCollapsed = useMemo(() => {
    if (!ancestorsOfSelected.some((id) => collapsed.has(id))) return collapsed;
    const next = new Set(collapsed);
    ancestorsOfSelected.forEach((id) => next.delete(id));
    return next;
  }, [collapsed, ancestorsOfSelected]);
  const rows = useMemo(() => listVisibleRows(root, visibleCollapsed), [root, visibleCollapsed]);

  // When the selection changes while someone is in the tree, focus follows it. Node ids are
  // only letters, digits, - and _ (the page schema checks), so they are safe in a selector.
  useEffect(() => {
    if (!selectedId || !tree.current?.contains(document.activeElement)) return;
    const row = tree.current.querySelector<HTMLElement>(`[data-layer-id="${selectedId}"]`);
    if (row && document.activeElement !== row && !renamingId) row.focus();
  }, [selectedId, rows, renamingId]);

  const toggleExpanded = useCallback((nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, nodeId: string) => {
      const list = rowsRef.current;
      const index = list.findIndex((row) => row.node.id === nodeId);
      const row = list[index];
      const selectWith = latest.current.onSelectWith;
      if (
        row &&
        selectWith &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        event.stopPropagation();
        return selectWith(nodeId, "siblings");
      }
      if (
        row &&
        selectWith &&
        event.shiftKey &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return selectWith(nodeId, event.key === "ArrowDown" ? "extendNext" : "extendPrevious");
      }
      if (!row || event.altKey || event.metaKey || event.ctrlKey) return;
      const select = (target: { node: PageNode } | undefined) => {
        if (target) latest.current.onSelect(target.node.id);
      };
      const isOpen = row.node.children.length > 0 && !collapsed.has(nodeId);
      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      switch (event.key) {
        case "ArrowDown":
          handled();
          return select(list[index + 1]);
        case "ArrowUp":
          handled();
          return select(list[index - 1]);
        case "Home":
          handled();
          return select(list[0]);
        case "End":
          handled();
          return select(list.at(-1));
        case "ArrowRight":
          handled();
          if (row.node.children.length === 0) return;
          return isOpen ? select(list[index + 1]) : toggleExpanded(nodeId);
        case "ArrowLeft": {
          handled();
          if (isOpen) return toggleExpanded(nodeId);
          const parent = list
            .slice(0, index)
            .findLast((candidate) => candidate.depth === row.depth - 1);
          return select(parent);
        }
        case "Enter":
        case "F2":
          handled();
          return setRenamingId(nodeId);
      }
    },
    [collapsed, toggleExpanded],
  );

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>, node: PageNode) => {
    dragged.current = { nodeId: node.id, type: node.type };
    event.dataTransfer.setData(layerDragType, node.id);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, node: PageNode) => {
      const insertType = readInsertType(event, catalogue);
      const source = dragged.current ?? (insertType ? { nodeId: null, type: insertType } : null);
      if (!source || source.nodeId === node.id) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const position = dropPositionAt(
        event.clientY - rect.top,
        rect.height,
        catalogue.canContain(node.type, source.type),
      );
      if (!dropPlace(root, catalogue, node, position, source.type)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = source.nodeId ? "move" : "copy";
      setDrop((current) =>
        current?.nodeId === node.id && current.position === position
          ? current
          : { nodeId: node.id, position },
      );
    },
    [root, catalogue],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, node: PageNode) => {
      event.preventDefault();
      const position = drop?.nodeId === node.id ? drop.position : "after";
      const insertKey = event.dataTransfer.getData(insertDragType);
      const type = dragged.current?.type ?? readInsertType(event, catalogue) ?? "";
      const place = dropPlace(root, catalogue, node, position, type);
      if (place && dragged.current?.nodeId)
        latest.current.onMove(dragged.current.nodeId, place.parentId, place.index);
      else if (place && insertKey)
        latest.current.onInsertAt(insertKey, place.parentId, place.index);
      dragged.current = null;
      setDrop(null);
    },
    [drop, root, catalogue],
  );

  const handleDragEnd = useCallback(() => {
    dragged.current = null;
    setDrop(null);
  }, []);

  const stable = useMemo(
    () => ({
      onSelect: (nodeId: string, held?: { toggle: boolean; range: boolean }) => {
        const selectWith = latest.current.onSelectWith;
        if (selectWith && held?.toggle) selectWith(nodeId, "toggle");
        else if (selectWith && held?.range) selectWith(nodeId, "range");
        else latest.current.onSelect(nodeId);
      },
      onHover: (nodeId: string | null) => latest.current.onHover(nodeId),
      onToggleHidden: (nodeId: string) => latest.current.onToggleHidden(nodeId),
      onToggleLocked: (nodeId: string) => latest.current.onToggleLocked(nodeId),
      onStartRename: (nodeId: string) => setRenamingId(nodeId),
      onFinishRename: (nodeId: string, name: string | null) => {
        setRenamingId(null);
        if (name !== null) latest.current.onRename(nodeId, name.trim());
        requestAnimationFrame(() =>
          tree.current?.querySelector<HTMLElement>(`[data-layer-id="${nodeId}"]`)?.focus(),
        );
      },
    }),
    [],
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-footnote text-label-secondary">
        {text("pageBuilder.layers.empty")}
      </p>
    );
  }

  const focusableId = rows.some((row) => row.node.id === selectedId)
    ? selectedId
    : rows[0]?.node.id;
  return (
    <div
      ref={tree}
      role="tree"
      aria-label={text("pageBuilder.layers.title")}
      aria-describedby="lintel-layers-help"
      aria-multiselectable={props.onSelectWith ? true : undefined}
      className="flex flex-col gap-px p-2"
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrop(null);
      }}
    >
      <p id="lintel-layers-help" className="sr-only">
        {text("pageBuilder.layers.keyboardHelp")}
      </p>
      {rows.map(({ node, depth }) => {
        const definition = catalogue.find(node.type);
        return (
          <LayerRow
            key={node.id}
            node={node}
            depth={depth}
            name={layerName(node, catalogue)}
            icon={definition?.icon}
            isSelected={node.id === selectedId || (props.selectedIds?.includes(node.id) ?? false)}
            isExpanded={!visibleCollapsed.has(node.id)}
            isRenaming={node.id === renamingId}
            isFocusable={node.id === focusableId}
            dropIndicator={drop?.nodeId === node.id ? drop.position : null}
            onToggleExpanded={toggleExpanded}
            onKeyDown={handleKeyDown}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            {...stable}
          />
        );
      })}
    </div>
  );
}

/**
 * The component type of what is being dragged in from the Insert panel. Browsers only show
 * the drag's data types until the drop, and in lower case, so the type travels as one of
 * them (`application/x-lintel-insert+codeblock`) and is matched back to the catalogue.
 */
function readInsertType(event: DragEvent, catalogue: ComponentCatalogue): string | null {
  const marker = Array.from(event.dataTransfer.types).find((type) =>
    type.startsWith(`${insertDragType}+`),
  );
  if (!marker) return null;
  const lowered = marker.slice(insertDragType.length + 1);
  return (
    catalogue.definitions.find((definition) => definition.type.toLowerCase() === lowered)?.type ??
    null
  );
}
