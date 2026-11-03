import type { PageNode } from "@lintel/builder-model";
import { ChevronRight, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { type DragEvent, type KeyboardEvent, memo, useEffect, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ComponentIcon } from "../ui/component-icons.js";
import { classNames } from "../ui/controls.js";
import type { DropPosition } from "./layer-drop.js";

export interface LayerRowProps {
  node: PageNode;
  depth: number;
  name: string;
  icon: string | undefined;
  isSelected: boolean;
  isExpanded: boolean;
  isRenaming: boolean;
  isFocusable: boolean;
  dropIndicator: DropPosition | null;
  /** With Ctrl/Cmd (`toggle`) or Shift (`range`) held, to select several. */
  onSelect: (nodeId: string, held?: { toggle: boolean; range: boolean }) => void;
  onHover: (nodeId: string | null) => void;
  onToggleExpanded: (nodeId: string) => void;
  onToggleHidden: (nodeId: string) => void;
  onToggleLocked: (nodeId: string) => void;
  onStartRename: (nodeId: string) => void;
  onFinishRename: (nodeId: string, name: string | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, nodeId: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, node: PageNode) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, node: PageNode) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, node: PageNode) => void;
  onDragEnd: () => void;
}

/**
 * One row of the Layers panel. Rows only redraw when their own node, place or state changes
 * (`memo`, with nodes shared between page versions), so a 300-element page stays quick.
 */
export const LayerRow = memo(function LayerRow(props: LayerRowProps) {
  const text = useBuilderText();
  const { node, depth, name, isSelected, isExpanded, isRenaming, dropIndicator } = props;
  const hasChildren = node.children.length > 0;

  return (
    <div
      role="treeitem"
      id={`layer-${node.id}`}
      data-layer-id={node.id}
      aria-level={depth + 1}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-label={[
        name,
        node.hidden && text("pageBuilder.layers.hiddenState"),
        node.locked && text("pageBuilder.layers.lockedState"),
      ]
        .filter(Boolean)
        .join(", ")}
      tabIndex={props.isFocusable ? 0 : -1}
      draggable={!isRenaming && !node.locked}
      onClick={(event) =>
        props.onSelect(node.id, {
          toggle: event.metaKey || event.ctrlKey,
          range: event.shiftKey,
        })
      }
      onDoubleClick={() => props.onStartRename(node.id)}
      onMouseEnter={() => props.onHover(node.id)}
      onMouseLeave={() => props.onHover(null)}
      onKeyDown={(event) => props.onKeyDown(event, node.id)}
      onDragStart={(event) => props.onDragStart(event, node)}
      onDragOver={(event) => props.onDragOver(event, node)}
      onDrop={(event) => props.onDrop(event, node)}
      onDragEnd={props.onDragEnd}
      style={{ paddingLeft: `${depth * 14 + 6}px` }}
      className={classNames(
        "group relative flex h-8 cursor-default items-center gap-1 rounded-control pe-1 text-footnote outline-none select-none focus-visible:focus-ring-inset",
        isSelected ? "bg-accent-fill text-on-accent" : "text-label hover:bg-fill",
        node.hidden && !isSelected && "text-label-tertiary",
        dropIndicator === "inside" && "ring-2 ring-accent-fill ring-inset",
      )}
    >
      {dropIndicator === "before" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-1 -top-px h-0.5 rounded bg-accent-fill"
        />
      )}
      {dropIndicator === "after" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-accent-fill"
        />
      )}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(event) => {
          event.stopPropagation();
          props.onToggleExpanded(node.id);
        }}
        className={classNames(
          "flex size-4 shrink-0 items-center justify-center",
          !hasChildren && "invisible",
        )}
      >
        <ChevronRight
          className={classNames(
            "size-3 transition-transform duration-150",
            isExpanded && "rotate-90",
          )}
        />
      </button>
      <ComponentIcon name={props.icon} className="size-3.5 shrink-0 opacity-70" />
      {isRenaming ? (
        <RenameInput name={name} onFinish={(nextName) => props.onFinishRename(node.id, nextName)} />
      ) : (
        <span className="min-w-0 flex-1 truncate">{name}</span>
      )}
      <RowToggle
        visible={node.locked}
        label={text(node.locked ? "pageBuilder.layers.unlock" : "pageBuilder.layers.lock", {
          name,
        })}
        icon={node.locked ? Lock : LockOpen}
        onClick={() => props.onToggleLocked(node.id)}
      />
      <RowToggle
        visible={node.hidden}
        label={text(node.hidden ? "pageBuilder.layers.show" : "pageBuilder.layers.hide", { name })}
        icon={node.hidden ? EyeOff : Eye}
        onClick={() => props.onToggleHidden(node.id)}
      />
    </div>
  );
});

/** Hide and lock: shown on hover and focus, and always while they're on. Shortcuts do the same. */
function RowToggle({
  visible,
  label,
  icon: Icon,
  onClick,
}: {
  visible: boolean;
  label: string;
  icon: typeof Eye;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={classNames(
        "flex size-6 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-fill-strong",
        visible && "opacity-100",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

function RenameInput({
  name,
  onFinish,
}: {
  name: string;
  onFinish: (name: string | null) => void;
}) {
  const text = useBuilderText();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const finished = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const finish = (nextName: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(nextName);
  };

  return (
    <input
      ref={input}
      aria-label={text("pageBuilder.layers.renameLabel")}
      value={value}
      maxLength={80}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(value);
        if (event.key === "Escape") finish(null);
      }}
      onBlur={() => finish(value)}
      className="h-6 min-w-0 flex-1 rounded bg-surface px-1 text-footnote text-label focus-visible:focus-ring"
    />
  );
}
