import {
  type DesignVariable,
  type DesignVariableKind,
  isDesignVariableValue,
  type SharedStyle,
} from "@lintel/builder-model";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName } from "../ui/controls.js";
import { addVariable, useSiteDesign, withSharedStyle } from "./site-design-context.js";

const kinds: ReadonlyArray<{
  kind: DesignVariableKind;
  title: BuilderStringKey;
  empty: BuilderStringKey;
  add: BuilderStringKey;
  newName: BuilderStringKey;
  start: string;
}> = [
  {
    kind: "colour",
    title: "pageBuilder.site.colours",
    empty: "pageBuilder.site.noColours",
    add: "pageBuilder.site.addColour",
    newName: "pageBuilder.site.newColour",
    start: "#8e8e93",
  },
  {
    kind: "size",
    title: "pageBuilder.site.sizes",
    empty: "pageBuilder.site.noSizes",
    add: "pageBuilder.site.addSize",
    newName: "pageBuilder.site.newSize",
    start: "2rem",
  },
  {
    kind: "font",
    title: "pageBuilder.site.fonts",
    empty: "pageBuilder.site.noFonts",
    add: "pageBuilder.site.addFont",
    newName: "pageBuilder.site.newFont",
    start: "Georgia, serif",
  },
];

/**
 * The Style tab with nothing selected: the site's own colours, sizes and fonts, and its
 * shared styles. Each can be renamed, changed or deleted here; every page follows. People
 * who may only use them see the lists without the controls.
 */
export function SiteStylesPanel({ uses }: { uses: ReadonlyMap<string, number> }) {
  const text = useBuilderText();
  const site = useSiteDesign();
  const { design, change } = site;
  const replaceVariable = (next: DesignVariable) =>
    change?.({
      ...design,
      variables: design.variables.map((each) => (each.id === next.id ? next : each)),
    });
  const removeVariable = (id: string) =>
    change?.({ ...design, variables: design.variables.filter((each) => each.id !== id) });
  const removeSharedStyle = (id: string) =>
    change?.({ ...design, sharedStyles: design.sharedStyles.filter((each) => each.id !== id) });

  return (
    <section aria-labelledby="site-styles-title" className="flex flex-col gap-4 px-4 pb-6">
      <div className="flex flex-col gap-1">
        <h2 id="site-styles-title" className="text-subheadline font-semibold text-label">
          {text("pageBuilder.site.title")}
        </h2>
        <p className="text-caption text-label-secondary">
          {text(change ? "pageBuilder.site.intro" : "pageBuilder.site.readOnly")}
        </p>
      </div>
      {kinds.map((group) => {
        const variables = design.variables.filter((each) => each.kind === group.kind);
        return (
          <div key={group.kind} className="flex flex-col gap-1.5">
            <h3 className="text-caption font-semibold text-label-secondary">{text(group.title)}</h3>
            {variables.length === 0 && (
              <p className="text-caption text-label-tertiary">{text(group.empty)}</p>
            )}
            {variables.map((variable) => (
              <VariableRow
                key={`${variable.id}:${variable.name}`}
                variable={variable}
                canChange={change !== undefined}
                onChange={replaceVariable}
                onRemove={() => removeVariable(variable.id)}
              />
            ))}
            {change && (
              <button
                type="button"
                onClick={() =>
                  change(addVariable(design, group.kind, text(group.newName), group.start).design)
                }
                className="flex items-center gap-1 self-start rounded-control px-1 py-0.5 text-caption font-medium text-accent hover:underline focus-visible:focus-ring"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                {text(group.add)}
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-caption font-semibold text-label-secondary">
          {text("pageBuilder.site.sharedStyles")}
        </h3>
        {design.sharedStyles.length === 0 && (
          <p className="text-caption text-label-tertiary">
            {text("pageBuilder.site.noSharedStyles")}
          </p>
        )}
        {design.sharedStyles.map((sharedStyle) => (
          <SharedStyleRow
            key={`${sharedStyle.id}:${sharedStyle.name}`}
            sharedStyle={sharedStyle}
            uses={uses.get(sharedStyle.id) ?? 0}
            canChange={change !== undefined}
            onRename={(name) => change?.(withSharedStyle(design, { ...sharedStyle, name }))}
            onRemove={() => removeSharedStyle(sharedStyle.id)}
          />
        ))}
      </div>
    </section>
  );
}

function VariableRow({
  variable,
  canChange,
  onChange,
  onRemove,
}: {
  variable: DesignVariable;
  canChange: boolean;
  onChange: (next: DesignVariable) => void;
  onRemove: () => void;
}) {
  const text = useBuilderText();
  const errorId = useId();
  const [typed, setTyped] = useState(variable.value);
  const [lastValue, setLastValue] = useState(variable.value);
  if (variable.value !== lastValue) {
    setLastValue(variable.value);
    setTyped(variable.value);
  }
  const isValid = isDesignVariableValue(variable.kind, typed);
  const isHex = /^#[0-9a-f]{6}$/i.test(variable.value);
  const commit = () => {
    if (isValid && typed.trim() !== variable.value) onChange({ ...variable, value: typed.trim() });
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {variable.kind === "colour" &&
          (canChange && isHex ? (
            <input
              type="color"
              aria-label={`${variable.name}: ${text("pageBuilder.site.value")}`}
              value={variable.value}
              onChange={(event) => onChange({ ...variable, value: event.target.value })}
              className="size-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          ) : (
            <span
              aria-hidden="true"
              style={{ backgroundColor: variable.value }}
              className="size-6 shrink-0 rounded-full hairline-ring"
            />
          ))}
        {canChange ? (
          <>
            <input
              aria-label={text("pageBuilder.site.name")}
              defaultValue={variable.name}
              maxLength={40}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== variable.name) onChange({ ...variable, name });
              }}
              className={`${inputClassName} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={onRemove}
              aria-label={text("pageBuilder.site.delete", { name: variable.name })}
              className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </button>
          </>
        ) : (
          <span className="text-footnote text-label">
            {variable.name}{" "}
            <span className="font-mono text-caption text-label-tertiary">{variable.value}</span>
          </span>
        )}
      </div>
      {canChange && (
        <input
          aria-label={`${variable.name}: ${text("pageBuilder.site.value")}`}
          aria-invalid={!isValid}
          aria-describedby={isValid ? undefined : errorId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className={`${inputClassName} font-mono`}
        />
      )}
      {!isValid && (
        <p id={errorId} className="text-caption text-warning">
          {text("pageBuilder.site.badValue", {
            kind: text(`pageBuilder.site.kind.${variable.kind}`),
          })}
        </p>
      )}
    </div>
  );
}

function SharedStyleRow({
  sharedStyle,
  uses,
  canChange,
  onRename,
  onRemove,
}: {
  sharedStyle: SharedStyle;
  uses: number;
  canChange: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const text = useBuilderText();
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent-fill" />
      {canChange ? (
        <input
          aria-label={text("pageBuilder.site.name")}
          defaultValue={sharedStyle.name}
          maxLength={40}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== sharedStyle.name) onRename(name);
          }}
          className={`${inputClassName} min-w-0 flex-1`}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-footnote text-label">{sharedStyle.name}</span>
      )}
      <span className="shrink-0 text-caption text-label-tertiary">
        {text("pageBuilder.shared.uses", { count: uses })}
      </span>
      {canChange && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={text("pageBuilder.site.delete", { name: sharedStyle.name })}
          className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill focus-visible:focus-ring"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
