import { type ComponentCatalogue, findPath, type PageNode } from "@lintel/builder-model";
import { ChevronRight } from "lucide-react";
import { layerName } from "../editor/commands.js";
import { useBuilderText } from "../i18n/builder-text.js";

/** Where the selected element sits: Page › Hero › Container › Heading. Each step selects it. */
export function Breadcrumbs({
  root,
  catalogue,
  selectedId,
  onSelect,
}: {
  root: PageNode;
  catalogue: ComponentCatalogue;
  selectedId: string | null;
  onSelect: (nodeId: string | null) => void;
}) {
  const text = useBuilderText();
  const path = selectedId ? findPath(root, selectedId) : [root];
  return (
    <nav
      aria-label={text("pageBuilder.breadcrumbs.label")}
      className="flex h-9 shrink-0 items-center hairline-bottom bg-surface px-3"
    >
      <ol className="flex min-w-0 items-center gap-0.5 overflow-hidden text-caption">
        {path.map((node, index) => {
          const isLast = index === path.length - 1;
          const name =
            index === 0 ? text("pageBuilder.breadcrumbs.page") : layerName(node, catalogue);
          return (
            <li key={node.id} className="flex min-w-0 items-center gap-0.5">
              {index > 0 && (
                <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-label-tertiary" />
              )}
              <button
                type="button"
                aria-current={isLast ? "location" : undefined}
                onClick={() => onSelect(index === 0 ? null : node.id)}
                className={`truncate rounded px-1.5 py-0.5 focus-visible:focus-ring ${isLast ? "font-semibold text-label" : "text-label-secondary hover:bg-fill hover:text-label"}`}
              >
                {name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
