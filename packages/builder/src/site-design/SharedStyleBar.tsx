import {
  baseSharedStyleOf,
  makeSharedStyle,
  type PageNode,
  type SharedStyle,
  sharedStylesById,
  variantsOf,
} from "@lintel/builder-model";
import { ChevronRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { DesignTools } from "../style-panel/design-tools.js";
import { ChoiceGroup, classNames, inputClassName } from "../ui/controls.js";
import { newSharedStyleId, useSiteDesign, withSharedStyle } from "./site-design-context.js";
import { SharedStylePreview } from "./SharedStylePreview.js";

export type SharedScope = "every" | "only";

const quietButton =
  "rounded-control px-1.5 py-0.5 text-caption font-medium text-accent hover:bg-fill focus-visible:focus-ring";

type Naming = "new" | "rename" | "variant" | null;

/**
 * The top of the Style panel: the shared style the element uses, as one clear row.
 *
 * Without one it says so, and offers to save this look to reuse it (or to use one the site
 * already has). With one it names it ("Nav link · 4 on this page"), says where changes go
 * (every element that uses it, or only this one), and offers Rename, Make a variant and
 * Detach. A shared style with variants lists them, to switch between.
 */
export function SharedStyleBar({
  node,
  design,
  uses,
  scope,
  onScopeChange,
  defaultName,
  isLocked,
}: {
  node: PageNode;
  design: DesignTools;
  uses: number;
  scope: SharedScope;
  onScopeChange: (scope: SharedScope) => void;
  defaultName: string;
  isLocked: boolean;
}) {
  const text = useBuilderText();
  const site = useSiteDesign();
  const [naming, setNaming] = useState<Naming>(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const all = site.design.sharedStyles;
  const shared = node.sharedStyle ? all.find((each) => each.id === node.sharedStyle) : undefined;
  const canChange = site.change !== undefined && !isLocked;

  if (naming) {
    const base = shared ? baseSharedStyleOf(shared, all) : undefined;
    return (
      <NameForm
        label={text(
          naming === "new"
            ? "pageBuilder.shared.nameLabel"
            : naming === "variant"
              ? "pageBuilder.shared.variantLabel"
              : "pageBuilder.shared.renameLabel",
        )}
        hint={
          naming === "variant" && base
            ? text("pageBuilder.shared.variantHint", { name: base.name })
            : undefined
        }
        initial={naming === "new" ? defaultName : naming === "rename" ? (shared?.name ?? "") : ""}
        placeholder={naming === "variant" ? text("pageBuilder.shared.variantExample") : undefined}
        onCancel={() => setNaming(null)}
        onSave={(name) => {
          setNaming(null);
          setIsChoosing(false);
          if (!site.change) return;
          if (naming === "rename" && shared) {
            site.change(withSharedStyle(site.design, { ...shared, name }));
            return;
          }
          if (naming === "variant" && base) {
            const id = newSharedStyleId(site.design, `${base.name} ${name}`);
            const variant: SharedStyle = { id, name, variantOf: base.id, styles: { base: {} } };
            site.change(withSharedStyle(site.design, variant));
            design.changeSharedStyle({ kind: "switch", id, name });
            onScopeChange("every");
            return;
          }
          const id = newSharedStyleId(site.design, name);
          // The look moves into the shared style: the page keeps the element's place only.
          const { sharedStyle } = makeSharedStyle(node, id, name);
          site.change(withSharedStyle(site.design, sharedStyle));
          design.changeSharedStyle({ kind: "make", id, name });
        }}
      />
    );
  }

  if (!node.sharedStyle) {
    if (all.length === 0 && !canChange) return null;
    return (
      <div className="flex flex-col overflow-hidden rounded-card bg-background">
        <button
          type="button"
          aria-expanded={isChoosing}
          disabled={isLocked}
          onClick={() => setIsChoosing((open) => !open)}
          className="flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-start hover:bg-fill/60 focus-visible:focus-ring disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full border border-label-tertiary"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-footnote font-medium text-label">
              {text("pageBuilder.shared.noneTitle")}
            </span>
            <span className="truncate text-caption text-label-secondary">
              {text(canChange ? "pageBuilder.shared.noneHint" : "pageBuilder.shared.useHint")}
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className={classNames(
              "size-3.5 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
              isChoosing && "rotate-90",
            )}
          />
        </button>
        {isChoosing && (
          <div className="flex flex-col gap-2 hairline-top px-3 pt-2 pb-3">
            {canChange && (
              <button
                type="button"
                onClick={() => setNaming("new")}
                className="h-8 rounded-control bg-accent-fill px-3 text-caption font-semibold text-on-accent hover:bg-accent-fill-hover focus-visible:focus-ring"
              >
                {text("pageBuilder.shared.saveLook")}
              </button>
            )}
            {all.length > 0 && (
              <div role="group" aria-label={text("pageBuilder.shared.useOne")}>
                <p className="mb-1 text-caption text-label-secondary">
                  {text("pageBuilder.shared.useOne")}
                </p>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {all
                    .filter((each) => !each.variantOf)
                    .flatMap((each) => [each, ...variantsOf(each, all)])
                    .map((each) => (
                      <li key={each.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChoosing(false);
                            design.changeSharedStyle({
                              kind: "use",
                              id: each.id,
                              name: each.name,
                            });
                          }}
                          className={classNames(
                            "flex h-8 w-full items-center gap-2 rounded-control px-1.5 text-start text-footnote text-label hover:bg-fill focus-visible:focus-ring",
                            each.variantOf && "ps-6",
                          )}
                        >
                          <SharedStylePreview sharedStyle={each} />
                          <span className="truncate">{each.name}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const base = shared ? baseSharedStyleOf(shared, all) : undefined;
  const family = base ? [base, ...variantsOf(base, all)] : [];
  const look = shared ? sharedStylesById(site.design)[shared.id] : undefined;
  return (
    <div className="flex flex-col gap-2.5 rounded-card bg-background p-3">
      <div className="flex items-center gap-2.5">
        {shared ? (
          <SharedStylePreview sharedStyle={look ?? shared} />
        ) : (
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent-fill" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-footnote font-semibold text-label">
            <span className="sr-only">{text("pageBuilder.shared.label")}: </span>
            {base && base !== shared ? `${base.name} · ` : ""}
            {shared?.name ?? node.sharedStyle}
          </span>
          <span className="text-caption text-label-secondary">
            {text("pageBuilder.shared.uses", { count: uses })}
          </span>
        </span>
      </div>
      {!shared ? (
        <p className="text-caption text-label-secondary">{text("pageBuilder.shared.missing")}</p>
      ) : (
        <>
          {family.length > 1 && (
            <ChoiceGroup<string>
              label={text("pageBuilder.shared.variant")}
              value={shared.id}
              onChange={(id) => {
                const chosen = family.find((each) => each.id === id);
                if (chosen) {
                  design.changeSharedStyle({ kind: "switch", id: chosen.id, name: chosen.name });
                }
              }}
              wraps
              choices={family.map((each) => ({
                value: each.id,
                label: each === base ? text("pageBuilder.shared.mainVariant") : each.name,
              }))}
            />
          )}
          {site.change && (
            <ChoiceGroup<SharedScope>
              label={text("pageBuilder.shared.changesApply")}
              value={scope}
              onChange={onScopeChange}
              choices={[
                { value: "every", label: text("pageBuilder.shared.every", { name: shared.name }) },
                { value: "only", label: text("pageBuilder.shared.onlyThis") },
              ]}
            />
          )}
        </>
      )}
      {!isLocked && (
        <div className="-mx-1.5 flex flex-wrap gap-0.5">
          {shared && canChange && (
            <button type="button" onClick={() => setNaming("rename")} className={quietButton}>
              {text("pageBuilder.shared.rename")}
            </button>
          )}
          {shared && canChange && (
            <button type="button" onClick={() => setNaming("variant")} className={quietButton}>
              {text("pageBuilder.shared.makeVariant")}
            </button>
          )}
          <button
            type="button"
            onClick={() => design.changeSharedStyle({ kind: "detach", sharedStyle: look })}
            className={quietButton}
          >
            {text("pageBuilder.shared.detach")}
          </button>
        </div>
      )}
    </div>
  );
}

function NameForm({
  label,
  hint,
  initial,
  placeholder,
  onSave,
  onCancel,
}: {
  label: string;
  hint?: string;
  initial: string;
  placeholder?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const text = useBuilderText();
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name.trim().slice(0, 40));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5 rounded-card bg-background p-3">
      <label className="flex flex-col gap-1 text-caption text-label-secondary">
        {label}
        <input
          value={name}
          placeholder={placeholder}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          maxLength={40}
          autoFocus
          className={inputClassName}
        />
      </label>
      {hint && <p className="text-caption text-label-tertiary">{hint}</p>}
      <div className="flex gap-1">
        <button
          type="submit"
          className="rounded-control bg-accent-fill px-2.5 py-1 text-caption font-medium text-on-accent focus-visible:focus-ring"
        >
          {text("pageBuilder.shared.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control bg-fill px-2.5 py-1 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          {text("pageBuilder.shared.cancel")}
        </button>
      </div>
    </form>
  );
}
