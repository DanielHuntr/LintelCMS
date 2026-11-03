import { makeSharedStyle, type PageNode } from "@lintel/builder-model";
import { type FormEvent, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { DesignTools } from "../style-panel/design-tools.js";
import { ChoiceGroup, inputClassName } from "../ui/controls.js";
import { newSharedStyleId, useSiteDesign, withSharedStyle } from "./site-design-context.js";

export type SharedScope = "every" | "only";

const smallButton =
  "rounded-control bg-fill px-2.5 py-1 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring";

/**
 * The top of the Style panel: the shared style the element uses, if any. Without one, a
 * short list offers the site's shared styles and "Make one from this look". With one, it
 * says which, how often it's on this page, and whether changes apply to every element that
 * uses it or only this one; Detach gives the element the look as its own.
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
  const [naming, setNaming] = useState<"new" | "rename" | null>(null);
  const shared = node.sharedStyle
    ? site.design.sharedStyles.find((each) => each.id === node.sharedStyle)
    : undefined;
  const canChange = site.change !== undefined && !isLocked;

  if (naming) {
    return (
      <NameForm
        label={text(
          naming === "new" ? "pageBuilder.shared.nameLabel" : "pageBuilder.shared.renameLabel",
        )}
        initial={naming === "new" ? defaultName : (shared?.name ?? "")}
        onCancel={() => setNaming(null)}
        onSave={(name) => {
          setNaming(null);
          if (!site.change) return;
          if (naming === "rename" && shared) {
            site.change(withSharedStyle(site.design, { ...shared, name }));
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
    if (site.design.sharedStyles.length === 0 && !canChange) return null;
    return (
      <label className="flex items-center gap-2 text-caption text-label-secondary">
        <span className="shrink-0">{text("pageBuilder.shared.label")}</span>
        <select
          value=""
          disabled={isLocked}
          onChange={(event) => {
            const choice = event.target.value;
            if (choice === "make") setNaming("new");
            const chosen = site.design.sharedStyles.find((each) => each.id === choice);
            if (chosen) design.changeSharedStyle({ kind: "use", id: chosen.id, name: chosen.name });
          }}
          className={`${inputClassName} h-7`}
        >
          <option value="">{text("pageBuilder.shared.none")}</option>
          {site.design.sharedStyles.map((each) => (
            <option key={each.id} value={each.id}>
              {each.name}
            </option>
          ))}
          {canChange && <option value="make">{text("pageBuilder.shared.make")}</option>}
        </select>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-control bg-accent-fill/10 p-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent-fill" />
        <span className="min-w-0 flex-1 truncate text-footnote font-semibold text-label">
          <span className="sr-only">{text("pageBuilder.shared.label")}: </span>
          {shared?.name ?? node.sharedStyle}
        </span>
        <span className="shrink-0 text-caption text-label-secondary">
          {text("pageBuilder.shared.uses", { count: uses })}
        </span>
      </div>
      {!shared ? (
        <p className="text-caption text-label-secondary">{text("pageBuilder.shared.missing")}</p>
      ) : (
        site.change && (
          <ChoiceGroup<SharedScope>
            label={text("pageBuilder.shared.changesApply")}
            value={scope}
            onChange={onScopeChange}
            choices={[
              { value: "every", label: text("pageBuilder.shared.every", { name: shared.name }) },
              { value: "only", label: text("pageBuilder.shared.onlyThis") },
            ]}
          />
        )
      )}
      <div className="flex flex-wrap gap-1">
        {shared && canChange && (
          <button type="button" onClick={() => setNaming("rename")} className={smallButton}>
            {text("pageBuilder.shared.rename")}
          </button>
        )}
        {!isLocked && (
          <button
            type="button"
            onClick={() => design.changeSharedStyle({ kind: "detach", sharedStyle: shared })}
            className={smallButton}
          >
            {text("pageBuilder.shared.detach")}
          </button>
        )}
      </div>
    </div>
  );
}

function NameForm({
  label,
  initial,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string;
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
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-caption text-label-secondary">
        {label}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          maxLength={40}
          autoFocus
          className={inputClassName}
        />
      </label>
      <div className="flex gap-1">
        <button
          type="submit"
          className="rounded-control bg-accent-fill px-2.5 py-1 text-caption font-medium text-white focus-visible:focus-ring"
        >
          {text("pageBuilder.shared.save")}
        </button>
        <button type="button" onClick={onCancel} className={smallButton}>
          {text("pageBuilder.shared.cancel")}
        </button>
      </div>
    </form>
  );
}
