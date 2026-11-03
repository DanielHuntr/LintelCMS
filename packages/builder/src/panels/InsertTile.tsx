import { Info, Plus, X } from "lucide-react";
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/classNames.js";
import { ComponentIcon } from "../ui/component-icons.js";
import { BlueprintSketch } from "./BlueprintSketch.js";
import type { InsertItem, InsertKey } from "./insert-library.js";

/** How long the pointer rests on a tile before its hover card shows. */
const hoverCardDelayMs = 450;

interface InsertTileProps {
  item: InsertItem;
  /**
   * "section" is a row with a small sketch, "element" a row with an icon, and "compact" the
   * small tile in the Recently used row.
   */
  look: "section" | "element" | "compact";
  /** Which edge the hover card and details line up with: tiles on the right open leftwards. */
  align: "start" | "end";
  onInsert: (key: InsertKey) => void;
  onDragStart: (event: DragEvent, item: InsertItem) => void;
  onDragEnd: (event: DragEvent, item: InsertItem) => void;
}

/**
 * One thing to insert: press it to add it, or drag it onto the page or into Layers. A section is a card with
 * a sketch of it and what it's for, shown in the list, since that is what beginners choose
 * by. An element is a row whose description is in a hover card (also shown when the tile has
 * keyboard focus). Both have a details popover opened with the ⓘ button, and screen readers
 * hear the description as the tile's.
 */
export function InsertTile({
  item,
  look,
  align,
  onInsert,
  onDragStart,
  onDragEnd,
}: InsertTileProps) {
  const text = useBuilderText();
  const descriptionId = useId();
  const hint = useHoverCard();
  const [isShowingDetails, setShowingDetails] = useState(false);
  const detailsButton = useRef<HTMLButtonElement>(null);

  const closeDetails = (returnFocus: boolean) => {
    setShowingDetails(false);
    if (returnFocus) detailsButton.current?.focus();
  };

  return (
    <div className="group relative" onMouseEnter={hint.pointerEnter} onMouseLeave={hint.hide}>
      <button
        type="button"
        draggable
        data-insert-tile
        aria-describedby={descriptionId}
        onClick={() => onInsert(item.key)}
        onDragStart={(event) => {
          hint.hide();
          onDragStart(event, item);
        }}
        onDragEnd={(event) => onDragEnd(event, item)}
        onFocus={hint.focus}
        onBlur={hint.hide}
        onKeyDown={(event) => {
          if (event.key === "Escape" && hint.isShown) {
            event.stopPropagation();
            hint.hide();
          }
        }}
        className={classNames(
          "flex w-full min-w-0 rounded-control text-start transition-colors duration-150 hover:bg-fill focus-visible:focus-ring",
          look === "section" && "flex-col items-stretch gap-1.5 p-1.5",
          look === "element" && "min-h-10 items-center gap-2 py-1 pe-7 ps-1.5",
          look === "compact" && "flex-col items-center gap-1 px-1 py-1.5",
        )}
      >
        <TileArt item={item} look={look} />
        <span
          className={classNames(
            // Names are shown in full, wrapping onto a second line rather than being cut off.
            "min-w-0 font-medium break-words text-label",
            look === "compact"
              ? "w-full text-center text-[11px] leading-tight"
              : "text-caption leading-snug",
            look === "section" && "pe-6",
          )}
        >
          {item.label}
        </span>
        {look === "section" && (
          <span aria-hidden="true" className="line-clamp-2 text-caption text-label-secondary">
            {item.description}
          </span>
        )}
      </button>
      <span id={descriptionId} className="sr-only">
        {item.description}
      </span>
      {look !== "compact" && (
        <button
          ref={detailsButton}
          type="button"
          aria-label={text("pageBuilder.insert.about", { name: item.label })}
          aria-expanded={isShowingDetails}
          aria-haspopup="dialog"
          onClick={() => {
            hint.hide();
            setShowingDetails((current) => !current);
          }}
          className={classNames(
            "absolute flex size-6 items-center justify-center rounded-full text-label-secondary transition-opacity duration-150 hover:bg-fill-strong hover:text-label focus-visible:opacity-100 focus-visible:focus-ring",
            look === "section" ? "top-2.5 inset-e-2.5 bg-surface/90" : "top-2 inset-e-1",
            isShowingDetails ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Info aria-hidden="true" className="size-3.5" />
        </button>
      )}
      {hint.isShown && !isShowingDetails && look === "element" && (
        <div
          aria-hidden="true"
          className={classNames(
            "pointer-events-none absolute top-full z-20 mt-1 w-56 rounded-card bg-surface-raised p-3 shadow-float hairline-ring",
            align === "start" ? "inset-s-0" : "inset-e-0",
          )}
        >
          <p className="text-footnote font-semibold text-label">{item.label}</p>
          <p className="mt-0.5 text-caption text-label-secondary">{item.description}</p>
        </div>
      )}
      {isShowingDetails && (
        <DetailsPopover item={item} align={align} onClose={closeDetails} onInsert={onInsert} />
      )}
    </div>
  );
}

function TileArt({ item, look }: { item: InsertItem; look: InsertTileProps["look"] }) {
  if (item.blueprint && look === "section") {
    return <BlueprintSketch blueprint={item.blueprint} />;
  }
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "flex shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary",
        look === "compact" ? "size-9" : "size-7",
      )}
    >
      <ComponentIcon name={item.blueprint ? "panel-top" : item.icon} className="size-4" />
    </span>
  );
}

/**
 * Shows after the pointer rests on the tile, or straight away when keyboard focus arrives
 * (not for a click, which already says what someone wants).
 */
function useHoverCard() {
  const [isShown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  return {
    isShown,
    pointerEnter: () => {
      clear();
      timer.current = setTimeout(() => setShown(true), hoverCardDelayMs);
    },
    focus: (event: { currentTarget: HTMLElement }) => {
      if (event.currentTarget.matches(":focus-visible")) setShown(true);
    },
    hide: () => {
      clear();
      setShown(false);
    },
  };
}

interface DetailsPopoverProps {
  item: InsertItem;
  align: "start" | "end";
  onClose: (returnFocus: boolean) => void;
  onInsert: (key: InsertKey) => void;
}

/**
 * The details of one item: a bigger picture, what it's for and how to add it. Not modal:
 * Escape or the close button closes it and puts focus back on ⓘ; clicking elsewhere or
 * tabbing away closes it too.
 */
function DetailsPopover({ item, align, onClose, onInsert }: DetailsPopoverProps) {
  const text = useBuilderText();
  const titleId = useId();
  const popover = useRef<HTMLDivElement>(null);
  const insertButton = useRef<HTMLButtonElement>(null);

  useEffect(() => insertButton.current?.focus(), []);
  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      const container = popover.current?.parentElement;
      if (container && !container.contains(event.target as Node)) onClose(false);
    }
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [onClose]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose(true);
  };

  return (
    <div
      ref={popover}
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!popover.current?.parentElement?.contains(event.relatedTarget as Node | null)) {
          onClose(false);
        }
      }}
      className={classNames(
        "absolute top-full z-30 mt-1 flex w-60 flex-col gap-2 rounded-card bg-surface-raised p-3 shadow-float hairline-ring",
        align === "start" ? "inset-s-0" : "inset-e-0",
      )}
    >
      <div className="flex items-start gap-2">
        <h4 id={titleId} className="min-w-0 flex-1 text-footnote font-semibold text-label">
          {item.label}
        </h4>
        <IconAction label={text("pageBuilder.insert.close")} onClick={() => onClose(true)}>
          <X aria-hidden="true" className="size-3.5" />
        </IconAction>
      </div>
      {item.blueprint && <BlueprintSketch blueprint={item.blueprint} />}
      <p className="text-caption text-label-secondary">{item.description}</p>
      <p className="text-caption text-label-tertiary">{text("pageBuilder.insert.howTo")}</p>
      <button
        ref={insertButton}
        type="button"
        onClick={() => {
          onInsert(item.key);
          onClose(false);
        }}
        className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-accent-fill px-3 text-footnote font-semibold text-on-accent focus-visible:focus-ring"
      >
        <Plus aria-hidden="true" className="size-4" />
        {text("pageBuilder.insert.insert", { name: item.label })}
      </button>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}
