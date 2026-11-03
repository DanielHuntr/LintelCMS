import {
  type AnyComponentDefinition,
  type ClientContentKind,
  clientEditsOf,
  type ComponentCatalogue,
  contentKindsOf,
  findPlace,
  hasItemList,
  type PageDocument,
  type PageNode,
  rootNodeId,
} from "@lintel/builder-model";
import { useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ToggleField } from "../panels/content-fields.js";
import { CollapsibleSection } from "../ui/CollapsibleSection.js";
import { classNames } from "../ui/classNames.js";

export interface ClientAccessChange {
  clientEdits?: ClientContentKind[] | null;
  clientRepeats?: boolean;
}

interface ClientAccessSectionProps {
  document: PageDocument;
  node: PageNode;
  definition: AnyComponentDefinition | undefined;
  catalogue: ComponentCatalogue;
  onChange: (nodeId: string, change: ClientAccessChange) => void;
}

/**
 * Where a client may add more items: the element itself when it has a list of items (a
 * gallery's pictures) or holds several of one kind (cards in a grid), else its parent when
 * that holds several of this one's kind. Null where there is nothing to repeat.
 */
export function repeatingPlace(
  document: PageDocument,
  node: PageNode,
  definition: AnyComponentDefinition | undefined,
): PageNode | null {
  const allAlike = (parent: PageNode) =>
    parent.children.length >= 2 &&
    parent.children.every((child) => child.type === parent.children[0]?.type);
  if (hasItemList(definition) || allAlike(node)) return node;
  const place = findPlace(document.root, node.id);
  if (place && place.parent.id !== rootNodeId && allAlike(place.parent)) return place.parent;
  return null;
}

/**
 * The designer's say over what clients may change on the selected element: its words,
 * pictures and links (only the kinds it has), or nothing, and whether they may add more of
 * its items. Closed until opened, so it stays out of the way.
 */
export function ClientAccessSection({
  document,
  node,
  definition,
  catalogue,
  onChange,
}: ClientAccessSectionProps) {
  const text = useBuilderText();
  const [isOpen, setIsOpen] = useState(false);
  const kinds = contentKindsOf(definition);
  const repeats = repeatingPlace(document, node, definition);
  if (kinds.length === 0 && !repeats) return null;

  const allowed = clientEditsOf(node, definition);
  const chosen = kinds.filter((kind) => allowed.has(kind));
  const summary =
    chosen.length === 0
      ? text("pageBuilder.clientAccess.summary.nothing")
      : chosen.map((kind) => text(`pageBuilder.clientAccess.${kind}`)).join(", ");
  const toggle = (kind: ClientContentKind) => {
    const next = allowed.has(kind) ? chosen.filter((each) => each !== kind) : [...chosen, kind];
    onChange(node.id, { clientEdits: kinds.filter((each) => next.includes(each)) });
  };
  const itemType = repeats && repeats.children.length >= 2 ? repeats.children[0]?.type : undefined;
  const repeatName = itemType
    ? (catalogue.find(itemType)?.label ?? itemType)
    : (definition?.label ?? node.type);

  return (
    <CollapsibleSection
      title={text("pageBuilder.clientAccess.title")}
      summary={summary}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
    >
      <div className="flex flex-col gap-3 px-4 pb-4">
        {kinds.length > 0 && (
          <div
            role="group"
            aria-label={text("pageBuilder.clientAccess.title")}
            className="flex flex-wrap gap-1.5"
          >
            {kinds.map((kind) => (
              <Chip key={kind} isOn={allowed.has(kind)} onClick={() => toggle(kind)}>
                {text(`pageBuilder.clientAccess.${kind}`)}
              </Chip>
            ))}
            <Chip isOn={chosen.length === 0} onClick={() => onChange(node.id, { clientEdits: [] })}>
              {text("pageBuilder.clientAccess.nothing")}
            </Chip>
          </div>
        )}
        {node.clientEdits !== undefined && kinds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(node.id, { clientEdits: null })}
            className="self-start text-caption text-accent hover:underline focus-visible:focus-ring"
          >
            {text("pageBuilder.clientAccess.reset")}
          </button>
        )}
        {repeats && (
          <div className="flex flex-col gap-1">
            <ToggleField
              label={text("pageBuilder.clientAccess.repeats")}
              value={repeats.clientRepeats === true}
              onChange={(value) => onChange(repeats.id, { clientRepeats: value })}
            />
            {repeats.clientRepeats && (
              <p className="text-caption text-label-secondary">
                {text("pageBuilder.clientAccess.repeatsHint", { name: repeatName })}
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function Chip({
  isOn,
  onClick,
  children,
}: {
  isOn: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={isOn}
      onClick={onClick}
      className={classNames(
        "h-7 rounded-full px-3 text-caption font-medium transition-colors duration-150 focus-visible:focus-ring",
        isOn ? "bg-accent-fill text-on-accent" : "bg-fill text-label hover:bg-fill-strong",
      )}
    >
      {children}
    </button>
  );
}
