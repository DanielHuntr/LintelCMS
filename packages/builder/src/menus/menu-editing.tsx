import type { PageNode } from "@lintel/builder-model";
import { ListTree } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, Labelled } from "../ui/controls.js";

/**
 * Editing a site menu without leaving the builder. The Header, Menu and Menu drawer show
 * one of the site's menus (Content → Menus); with one selected, the Content tab offers
 * "Which menu" and "Edit menu", which opens the app's own menu editor in the panel, so the
 * changes go to the same menu the Menus screen shows. The builder only knows the menus'
 * names and links; the app draws the editor and saves.
 */

/** The elements that can show a site menu. */
export const menuElementTypes: ReadonlySet<string> = new Set([
  "siteHeader",
  "mobileMenu",
  "navigation",
]);

export interface MenuEditorProps {
  menuHandle: string;
  /** Called once the menu is saved (or the editor closed), to redraw the canvas. */
  onClose: () => void;
}

/** What the app gives the builder for menus: the editor to show, inside the Content tab. */
export type RenderMenuEditor = (props: MenuEditorProps) => ReactNode;

interface MenuEditingState {
  renderEditor: RenderMenuEditor | undefined;
  /** The site's menus, for "Which menu". */
  choices: readonly { value: string; label: string }[];
  /** The element whose menu is being edited in the panel, if any. */
  editingFor: string | null;
  setEditingFor: (nodeId: string | null) => void;
}

export const MenuEditingContext = createContext<MenuEditingState>({
  renderEditor: undefined,
  choices: [],
  editingFor: null,
  setEditingFor: () => undefined,
});

/** Whether the element shows one of the site's menus (rather than links of its own). */
export function showsSiteMenu(node: PageNode): boolean {
  return menuElementTypes.has(node.type) && node.props.menuSource === "site";
}

interface MenuSectionProps {
  node: PageNode;
  isLocked: boolean;
  onChange: (props: Record<string, unknown>, label: string) => void;
}

/** "Which menu" and "Edit menu", at the top of the Content tab for menu elements. */
export function MenuSection({ node, isLocked, onChange }: MenuSectionProps) {
  const text = useBuilderText();
  const { renderEditor, choices, editingFor, setEditingFor } = useContext(MenuEditingContext);
  if (!showsSiteMenu(node)) return null;
  const handle = typeof node.props.menuHandle === "string" ? node.props.menuHandle : "main";
  const isEditing = editingFor === node.id && renderEditor !== undefined;
  const options = choices.some((choice) => choice.value === handle)
    ? choices
    : [{ value: handle, label: handle }, ...choices];

  return (
    <section
      aria-label={text("pageBuilder.menu.section")}
      className="flex flex-col gap-3 border-b border-separator px-4 py-3"
    >
      <Labelled label={text("pageBuilder.menu.which")}>
        {(id) => (
          <select
            id={id}
            value={handle}
            disabled={isLocked}
            onChange={(event) =>
              onChange({ menuHandle: event.target.value }, text("pageBuilder.menu.which"))
            }
            className={inputClassName}
          >
            {options.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        )}
      </Labelled>
      {renderEditor && !isEditing && (
        <button
          type="button"
          disabled={isLocked}
          onClick={() => setEditingFor(node.id)}
          className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-accent-fill px-3 text-footnote font-medium text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring disabled:opacity-40"
        >
          <ListTree aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {text("pageBuilder.menu.edit")}
        </button>
      )}
      {!renderEditor && (
        <p className="text-caption text-label-tertiary">{text("pageBuilder.menu.whereToEdit")}</p>
      )}
      {isEditing && renderEditor({ menuHandle: handle, onClose: () => setEditingFor(null) })}
    </section>
  );
}
