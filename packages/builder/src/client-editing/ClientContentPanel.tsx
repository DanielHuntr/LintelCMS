import {
  clientEditableFields,
  clientEditsOf,
  type ComponentCatalogue,
  customBlockType,
  findPath,
  type PageNode,
} from "@lintel/builder-model";
import { Copy, ImageIcon, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ContentPanel } from "../panels/ContentPanel.js";
import type { ImagePicker } from "../panels/content-fields.js";
import { ItemsCanChangeContext } from "../panels/item-list-field.js";
import { BlockInstancePanel } from "../blocks/BlockInstancePanel.js";

interface ClientContentPanelProps {
  root: PageNode;
  /** The selected element, or null for none (or one in the site's navigation or footer). */
  node: PageNode | null;
  nodeName: string;
  catalogue: ComponentCatalogue;
  pickImage: ImagePicker | undefined;
  onChangeProps: (nodeId: string, props: Record<string, unknown>, label: string) => void;
  onReplacePicture: (node: PageNode) => void;
  onAddAnother: (item: PageNode) => void;
  onRemove: (item: PageNode) => void;
}

/**
 * The item the selected element belongs to, where clients may add more of them: the
 * element itself or the nearest one around it whose parent has "Clients can add more of
 * these" on. Null where items can't be added or removed.
 */
export function repeatableItem(
  root: PageNode,
  nodeId: string,
): { item: PageNode; parent: PageNode } | null {
  const path = findPath(root, nodeId);
  for (let index = path.length - 1; index > 0; index -= 1) {
    const parent = path[index - 1];
    const item = path[index];
    if (parent?.clientRepeats && item) return { item, parent };
  }
  return null;
}

/**
 * The right-hand panel of the client's view: the selected element's words, picture and
 * link (only those the designer opened up), "Add another" and "Remove this one" where they
 * may add more, and a calm note for parts of the design that stay as they are.
 */
export function ClientContentPanel({
  root,
  node,
  nodeName,
  catalogue,
  pickImage,
  onChangeProps,
  onReplacePicture,
  onAddAnother,
  onRemove,
}: ClientContentPanelProps) {
  const text = useBuilderText();
  const definition = node ? catalogue.find(node.type) : undefined;
  // The element as a client sees it: only the fields they may change.
  const clientDefinition = useMemo(
    () =>
      node && definition
        ? { ...definition, editableFields: clientEditableFields(node, definition) }
        : undefined,
    [node, definition],
  );
  const repeat = node ? repeatableItem(root, node.id) : null;
  const canChange = (clientDefinition?.editableFields.length ?? 0) > 0;
  const isPicture =
    node?.type === "image" && definition && clientEditsOf(node, definition).has("pictures");

  return (
    <aside
      aria-labelledby="lintel-client-panel-heading"
      data-tour="client-panel"
      className="flex w-80 shrink-0 flex-col border-s border-separator bg-surface"
    >
      <h2
        id="lintel-client-panel-heading"
        tabIndex={-1}
        className="flex h-11 shrink-0 items-center hairline-bottom px-4 text-footnote font-semibold text-label"
      >
        {node ? nodeName : text("pageBuilder.clientView.panelLabel")}
      </h2>
      <div className="min-h-0 flex-1 overflow-auto">
        {!node ? (
          <div className="flex flex-col gap-1 px-4 py-6">
            <p className="text-subheadline font-semibold text-label">
              {text("pageBuilder.clientView.empty.title")}
            </p>
            <p className="text-footnote text-label-secondary">
              {text("pageBuilder.clientView.empty.text")}
            </p>
          </div>
        ) : node.type === customBlockType ? (
          // A component: its properties, and its variants where its designer allows it.
          <BlockInstancePanel
            node={node}
            isLocked={false}
            isClient
            onChange={(values, name) => onChangeProps(node.id, { values }, name)}
            onChangeVariant={(variant, name) => onChangeProps(node.id, { variant }, name)}
          />
        ) : (
          <>
            {isPicture && pickImage && (
              <div className="px-4 pt-4">
                <button
                  type="button"
                  onClick={() => onReplacePicture(node)}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-control bg-accent-fill text-footnote font-semibold text-on-accent focus-visible:focus-ring"
                >
                  <ImageIcon aria-hidden="true" className="size-4" />
                  {text("pageBuilder.clientView.replacePicture")}
                </button>
              </div>
            )}
            {canChange ? (
              <ItemsCanChangeContext value={node.clientRepeats === true}>
                <ContentPanel
                  node={node}
                  definition={clientDefinition}
                  isLocked={false}
                  pickImage={pickImage}
                  onChange={(props, label) => onChangeProps(node.id, props, label)}
                />
              </ItemsCanChangeContext>
            ) : (
              !repeat && (
                <p className="px-4 py-6 text-footnote text-label-secondary">
                  {text("pageBuilder.clientView.locked", { name: nodeName })}
                </p>
              )
            )}
            {repeat && (
              <section
                aria-label={text("pageBuilder.clientView.items")}
                className="flex flex-col gap-2 px-4 py-4"
              >
                <button
                  type="button"
                  onClick={() => onAddAnother(repeat.item)}
                  className="flex h-8 items-center gap-1.5 self-start rounded-control px-2 text-footnote font-medium text-accent hover:bg-fill focus-visible:focus-ring"
                >
                  <Copy aria-hidden="true" className="size-3.5" />
                  {text("pageBuilder.clientView.addAnother")}
                </button>
                <button
                  type="button"
                  disabled={repeat.parent.children.length <= 1}
                  onClick={() => onRemove(repeat.item)}
                  className="flex h-8 items-center gap-1.5 self-start rounded-control px-2 text-footnote font-medium text-danger hover:bg-fill focus-visible:focus-ring disabled:opacity-40"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  {text("pageBuilder.clientView.remove")}
                </button>
                {repeat.parent.children.length <= 1 && (
                  <p className="text-caption text-label-secondary">
                    {text("pageBuilder.clientView.keepOne")}
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
