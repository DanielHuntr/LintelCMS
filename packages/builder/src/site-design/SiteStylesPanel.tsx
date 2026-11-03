import {
  type Breakpoint,
  type DesignVariable,
  type DesignVariableKind,
  isDesignVariableValue,
  type SharedStyle,
  sharedStylesById,
  tagStyleKinds,
  type TagStyleKind,
  variantsOf,
  withoutSharedStyle,
  withoutVariable,
} from "@lintel/builder-model";
import { ChevronLeft, ChevronRight, Moon, MousePointerClick, Plus } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import type { BuilderStringKey } from "../i18n/builder-strings.js";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames, inputClassName } from "../ui/controls.js";
import { addVariable, useSiteDesign, withSharedStyle } from "./site-design-context.js";
import { SharedStylePreview } from "./SharedStylePreview.js";
import { TagStyleEditor, tagStyleKindDetails } from "./TagStyleEditor.js";

/** A starting point offered while a group is empty: tap it and it's added. */
interface Suggestion {
  name: BuilderStringKey;
  value: string;
}

const kinds: ReadonlyArray<{
  kind: DesignVariableKind;
  title: BuilderStringKey;
  empty: BuilderStringKey;
  add: BuilderStringKey;
  newName: BuilderStringKey;
  start: string;
  suggestions: readonly Suggestion[];
}> = [
  {
    kind: "colour",
    title: "pageBuilder.site.colours",
    empty: "pageBuilder.siteStyles.coloursEmpty",
    add: "pageBuilder.site.addColour",
    newName: "pageBuilder.site.newColour",
    start: "#8e8e93",
    suggestions: [
      { name: "pageBuilder.siteStyles.suggest.ink", value: "#1f2328" },
      { name: "pageBuilder.siteStyles.suggest.paper", value: "#faf7f2" },
      { name: "pageBuilder.siteStyles.suggest.accent", value: "#b4532a" },
    ],
  },
  {
    kind: "size",
    title: "pageBuilder.site.sizes",
    empty: "pageBuilder.siteStyles.sizesEmpty",
    add: "pageBuilder.site.addSize",
    newName: "pageBuilder.site.newSize",
    start: "2rem",
    suggestions: [
      { name: "pageBuilder.siteStyles.suggest.gutter", value: "1.5rem" },
      { name: "pageBuilder.siteStyles.suggest.sectionSpace", value: "6rem" },
      { name: "pageBuilder.siteStyles.suggest.readingWidth", value: "42rem" },
    ],
  },
  {
    kind: "font",
    title: "pageBuilder.site.fonts",
    empty: "pageBuilder.siteStyles.fontsEmpty",
    add: "pageBuilder.site.addFont",
    newName: "pageBuilder.site.newFont",
    start: "Georgia, serif",
    suggestions: [
      { name: "pageBuilder.siteStyles.suggest.display", value: "Georgia, serif" },
      { name: "pageBuilder.siteStyles.suggest.text", value: "system-ui, sans-serif" },
    ],
  },
];

export interface SiteStylesPanelProps {
  /** How many elements on this page use each shared style. */
  sharedStyleUses: ReadonlyMap<string, number>;
  /** How many styles name each variable, on this page and in the site's shared styles. */
  variableUses: ReadonlyMap<string, number>;
  /** Shown with a selection: goes back to the element's Style. */
  onBack?: () => void;
  /** Writes a variable's value out on this page's elements, before it's deleted. */
  onDeleteVariable?: (variable: DesignVariable) => void;
  /** Detaches this page's elements from a shared style, keeping their look, before it goes. */
  onDeleteSharedStyle?: (sharedStyle: SharedStyle) => void;
  /** Selects the elements on this page that use a shared style, and outlines them all. */
  onSelectUsers?: (sharedStyleId: string) => void;
  /** The screen size being designed, where changes to "All headings" and the like go. */
  breakpoint?: Breakpoint;
  /** Codes like "#1f2328" and "1.5rem" beside each one; the builder leaves them out (swatches and names only). */
  showsValues?: boolean;
}

/** Whether colours and sizes show their codes, or only their swatches. */
const ShowsValuesContext = createContext(true);

/**
 * Site styles: the site's named colours, sizes and fonts, and its shared styles, in the right
 * panel. With something selected it opens from "Site styles" in Style and has a Back button;
 * with nothing selected it's what Style shows. Rows are short and open one at a time to be
 * renamed, changed or deleted; empty groups offer a few starting points. People who may only
 * use them see the lists without the controls.
 */
export function SiteStylesPanel({
  sharedStyleUses,
  variableUses,
  onBack,
  onDeleteVariable,
  onDeleteSharedStyle,
  onSelectUsers,
  breakpoint = "base",
  showsValues = true,
}: SiteStylesPanelProps) {
  const text = useBuilderText();
  const { design, change } = useSiteDesign();
  const looks = sharedStylesById(design);
  const [openId, setOpenId] = useState<string | null>(null);
  // "All headings" and the like open over the list, with Back.
  const [editingKind, setEditingKind] = useState<TagStyleKind | null>(null);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const replaceVariable = (next: DesignVariable) =>
    change?.({
      ...design,
      variables: design.variables.map((each) => (each.id === next.id ? next : each)),
    });
  const add = (kind: DesignVariableKind, name: string, value: string) => {
    if (!change) return;
    const added = addVariable(design, kind, name, value);
    change(added.design);
    setOpenId(`variable:${added.variable.id}`);
  };

  if (editingKind) {
    return (
      <TagStyleEditor
        kind={editingKind}
        breakpoint={breakpoint}
        onBack={() => setEditingKind(null)}
      />
    );
  }

  return (
    <ShowsValuesContext value={showsValues}>
      <section aria-labelledby="site-styles-title" className="flex flex-col gap-5 px-4 pt-3 pb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ms-1.5 flex h-8 items-center gap-0.5 self-start rounded-control pe-2 text-body font-medium text-label-secondary hover:bg-fill focus-visible:focus-ring"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {text("pageBuilder.siteStyles.back")}
          </button>
        )}
        <div className="flex flex-col gap-0.5">
          <h2 id="site-styles-title" className="text-headline font-semibold text-label">
            {text("pageBuilder.siteStyles.title")}
          </h2>
          <p className="text-caption text-label-secondary">
            {text(change ? "pageBuilder.siteStyles.intro" : "pageBuilder.site.readOnly")}
          </p>
          {!onBack && (
            <p className="text-caption text-label-tertiary">
              {text("pageBuilder.siteStyles.selectHint")}
            </p>
          )}
        </div>
        {kinds.map((group) => {
          const variables = design.variables.filter((each) => each.kind === group.kind);
          const taken = new Set(variables.map((each) => each.name));
          return (
            <Group
              key={group.kind}
              title={text(group.title)}
              addLabel={change ? text(group.add) : undefined}
              onAdd={() => add(group.kind, text(group.newName), group.start)}
            >
              {variables.length === 0 ? (
                <EmptyGroup
                  note={text(group.empty)}
                  suggestions={
                    change
                      ? group.suggestions
                          .map((each) => ({ name: text(each.name), value: each.value }))
                          .filter((each) => !taken.has(each.name))
                      : []
                  }
                  kind={group.kind}
                  onPick={(name, value) => add(group.kind, name, value)}
                />
              ) : (
                <List>
                  {variables.map((variable) => (
                    <VariableRow
                      key={variable.id}
                      variable={variable}
                      uses={variableUses.get(variable.id) ?? 0}
                      isOpen={openId === `variable:${variable.id}`}
                      onToggle={change ? () => toggle(`variable:${variable.id}`) : undefined}
                      onChange={replaceVariable}
                      onDelete={() => {
                        onDeleteVariable?.(variable);
                        change?.(withoutVariable(design, variable.id));
                        setOpenId(null);
                      }}
                    />
                  ))}
                </List>
              )}
            </Group>
          );
        })}
        <Group title={text("pageBuilder.site.sharedStyles")}>
          {design.sharedStyles.length === 0 ? (
            <EmptyGroup note={text("pageBuilder.siteStyles.sharedEmpty")} suggestions={[]} />
          ) : (
            <List>
              {design.sharedStyles
                .filter((each) => !each.variantOf || !looks[each.variantOf])
                .flatMap((each) => [each, ...variantsOf(each, design.sharedStyles)])
                .map((sharedStyle) => (
                  <SharedStyleRow
                    key={sharedStyle.id}
                    sharedStyle={sharedStyle}
                    look={looks[sharedStyle.id] ?? sharedStyle}
                    uses={sharedStyleUses.get(sharedStyle.id) ?? 0}
                    isOpen={openId === `shared:${sharedStyle.id}`}
                    onToggle={() => toggle(`shared:${sharedStyle.id}`)}
                    canChange={change !== undefined}
                    onSelect={onSelectUsers ? () => onSelectUsers(sharedStyle.id) : undefined}
                    onRename={(name) => change?.(withSharedStyle(design, { ...sharedStyle, name }))}
                    onDelete={() => {
                      onDeleteSharedStyle?.(sharedStyle);
                      change?.(withoutSharedStyle(design, sharedStyle.id));
                      setOpenId(null);
                    }}
                  />
                ))}
            </List>
          )}
        </Group>
        <Group title={text("pageBuilder.tagStyles.group")}>
          <List>
            {tagStyleKinds.map((kind) => {
              const isSet = design.tagStyles?.[kind] !== undefined;
              return (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => setEditingKind(kind)}
                    className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-start hover:bg-fill/60 focus-visible:focus-ring"
                  >
                    <span className="min-w-0 flex-1 truncate text-footnote font-medium text-label">
                      {text(tagStyleKindDetails[kind].title)}
                    </span>
                    {isSet && (
                      <span className="flex shrink-0 items-center gap-1.5 text-caption text-label-tertiary">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-fill" />
                        {text("pageBuilder.tagStyles.set")}
                      </span>
                    )}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-label-tertiary"
                    />
                  </button>
                </li>
              );
            })}
          </List>
          <p className="px-1 text-caption text-label-tertiary">
            {text("pageBuilder.tagStyles.groupNote")}
          </p>
        </Group>
      </section>
    </ShowsValuesContext>
  );
}

function Group({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center">
        <h3
          id={headingId}
          className="text-caption font-semibold tracking-wide text-label-secondary uppercase"
        >
          {title}
        </h3>
        {addLabel && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
            className="ms-auto flex size-6 items-center justify-center rounded-control text-accent hover:bg-fill focus-visible:focus-ring"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card bg-background p-0 [&>li+li]:hairline-top">
      {children}
    </ul>
  );
}

function EmptyGroup({
  note,
  suggestions,
  kind,
  onPick,
}: {
  note: string;
  suggestions: ReadonlyArray<{ name: string; value: string }>;
  kind?: DesignVariableKind;
  onPick?: (name: string, value: string) => void;
}) {
  const text = useBuilderText();
  return (
    <div className="flex flex-col gap-2 rounded-card bg-background px-3 py-2.5">
      <p className="text-caption text-label-secondary">{note}</p>
      {suggestions.length > 0 && onPick && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="me-0.5 text-caption text-label-tertiary">
            {text("pageBuilder.siteStyles.startWith")}
          </span>
          {suggestions.map((each) => (
            <button
              key={each.name}
              type="button"
              onClick={() => onPick(each.name, each.value)}
              className="flex h-7 items-center gap-1.5 rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
            >
              {kind === "colour" && (
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: each.value }}
                  className="size-3 rounded-full hairline-ring"
                />
              )}
              {each.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** How a variable looks in its row: a swatch, "Aa" in the font, or a short bar for a size. */
function VariablePreview({ variable }: { variable: DesignVariable }) {
  if (variable.kind === "colour") {
    return (
      <span
        aria-hidden="true"
        style={{
          background: variable.darkValue
            ? `linear-gradient(135deg, ${variable.value} 50%, ${variable.darkValue} 50%)`
            : variable.value,
        }}
        className="size-6 shrink-0 rounded-full hairline-ring"
      />
    );
  }
  if (variable.kind === "font") {
    return (
      <span
        aria-hidden="true"
        style={{ fontFamily: variable.value }}
        className="flex size-6 shrink-0 items-center justify-center rounded-control bg-fill text-footnote text-label"
      >
        Aa
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-control bg-fill"
    >
      <span className="h-0.5 w-3.5 rounded-full bg-label-secondary" />
    </span>
  );
}

function UsesLabel({ text: shown }: { text: string | null }) {
  if (!shown) return null;
  return <span className="shrink-0 text-caption text-label-tertiary">{shown}</span>;
}

/** A row that opens to show its editor below it; without `onToggle` it's a plain row. */
function Row({
  preview,
  name,
  detail,
  uses,
  isOpen,
  onToggle,
  children,
}: {
  preview: ReactNode;
  name: string;
  detail?: string;
  uses: string | null;
  isOpen: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  const editorId = useId();
  const content = (
    <>
      {preview}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-footnote font-medium text-label">{name}</span>
        {detail && (
          <span className="truncate font-mono text-caption text-label-tertiary">{detail}</span>
        )}
      </span>
      <UsesLabel text={uses} />
    </>
  );
  return (
    <li>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={editorId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-start hover:bg-fill/60 focus-visible:focus-ring"
        >
          {content}
          <ChevronRight
            aria-hidden="true"
            className={classNames(
              "size-3.5 shrink-0 text-label-tertiary motion-safe:transition-transform motion-safe:duration-150",
              isOpen && "rotate-90",
            )}
          />
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-2.5 px-3 py-1.5">{content}</div>
      )}
      <div id={editorId} hidden={!isOpen}>
        {isOpen && <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">{children}</div>}
      </div>
    </li>
  );
}

function VariableRow({
  variable,
  uses,
  isOpen,
  onToggle,
  onChange,
  onDelete,
}: {
  variable: DesignVariable;
  uses: number;
  isOpen: boolean;
  onToggle?: () => void;
  onChange: (next: DesignVariable) => void;
  onDelete: () => void;
}) {
  const text = useBuilderText();
  const showsValues = useContext(ShowsValuesContext);
  return (
    <Row
      preview={<VariablePreview variable={variable} />}
      name={variable.name}
      detail={
        !showsValues
          ? undefined
          : variable.darkValue
            ? `${variable.value} · ${variable.darkValue}`
            : variable.value
      }
      uses={
        uses === 0
          ? null
          : uses === 1
            ? text("pageBuilder.siteStyles.usesOne")
            : text("pageBuilder.siteStyles.uses", { count: uses })
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <NameInput name={variable.name} onChange={(name) => onChange({ ...variable, name })} />
      <ValueInput
        label={`${variable.name}: ${text("pageBuilder.site.value")}`}
        shownLabel={variable.darkValue ? text("pageBuilder.siteStyles.lightValue") : undefined}
        kind={variable.kind}
        value={variable.value}
        onChange={(value) => onChange({ ...variable, value })}
      />
      {variable.kind === "colour" && <DarkValue variable={variable} onChange={onChange} />}
      <DeleteAction
        name={variable.name}
        note={
          uses > 0
            ? text("pageBuilder.siteStyles.deleteUsed", { count: uses })
            : text("pageBuilder.siteStyles.deleteUnused")
        }
        onDelete={onDelete}
      />
    </Row>
  );
}

/**
 * A colour's dark-mode value: offered as "Add a dark-mode colour" until there is one, then
 * changed or taken off here. Used wherever the site shows in dark mode.
 */
function DarkValue({
  variable,
  onChange,
}: {
  variable: DesignVariable;
  onChange: (next: DesignVariable) => void;
}) {
  const text = useBuilderText();
  if (variable.darkValue === undefined) {
    return (
      <button
        type="button"
        onClick={() => onChange({ ...variable, darkValue: suggestDark(variable.value) })}
        className="flex items-center gap-1 self-start rounded-control px-1 py-0.5 text-caption font-medium text-accent hover:underline focus-visible:focus-ring"
      >
        <Moon aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.siteStyles.addDark")}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <ValueInput
        label={`${variable.name}: ${text("pageBuilder.siteStyles.darkValue")}`}
        shownLabel={text("pageBuilder.siteStyles.darkValue")}
        kind="colour"
        value={variable.darkValue}
        onChange={(darkValue) => onChange({ ...variable, darkValue })}
      />
      <button
        type="button"
        onClick={() => {
          const rest: DesignVariable = { ...variable };
          delete rest.darkValue;
          onChange(rest);
        }}
        className="self-start rounded-control px-1 py-0.5 text-caption text-label-secondary hover:underline focus-visible:focus-ring"
      >
        {text("pageBuilder.siteStyles.sameInDark")}
      </button>
    </div>
  );
}

/** A starting dark-mode colour: the light one's brightness turned round, for six-digit hex. */
function suggestDark(light: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(light.trim())?.[1];
  if (!hex) return "#1c1c1e";
  const channels = [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const turned = channels.map((channel) =>
    Math.round(255 - channel * 0.92)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${turned.join("")}`;
}

function NameInput({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const text = useBuilderText();
  return (
    <label className="flex flex-col gap-1 text-caption text-label-secondary">
      {text("pageBuilder.site.name")}
      <input
        key={name}
        defaultValue={name}
        maxLength={40}
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next && next !== name) onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={inputClassName}
      />
    </label>
  );
}

/** A variable's value, typed or (for a colour) picked; refused with a note when it isn't one. */
export function ValueInput({
  label,
  kind,
  value,
  onChange,
  shownLabel,
}: {
  label: string;
  kind: DesignVariableKind;
  value: string;
  onChange: (value: string) => void;
  /** The words shown above it; "Value" when left out. */
  shownLabel?: string;
}) {
  const text = useBuilderText();
  const errorId = useId();
  const [typed, setTyped] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(value);
  }
  const isValid = isDesignVariableValue(kind, typed);
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  // Beginners pick a colour from its swatch; the code is for people who want it.
  const showsCode = useContext(ShowsValuesContext) || kind !== "colour" || !isHex;
  const commit = () => {
    if (isValid && typed.trim() !== value) onChange(typed.trim());
  };
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-caption text-label-secondary">
        {shownLabel ?? text("pageBuilder.site.value")}
      </span>
      <div className="flex items-center gap-1.5">
        {kind === "colour" && isHex && (
          <input
            type="color"
            aria-label={`${label} (${text("pageBuilder.siteStyles.colourValue")})`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="size-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
        )}
        <input
          hidden={!showsCode}
          aria-label={label}
          aria-invalid={!isValid}
          aria-describedby={isValid ? undefined : errorId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
          className={`${inputClassName} min-w-0 flex-1 font-mono`}
        />
      </div>
      {!isValid && (
        <p id={errorId} className="text-caption text-warning">
          {text("pageBuilder.site.badValue", { kind: text(`pageBuilder.site.kind.${kind}`) })}
        </p>
      )}
    </div>
  );
}

/** Delete, then a second tap to be sure, saying what happens to what uses it. */
export function DeleteAction({
  name,
  note,
  onDelete,
}: {
  name: string;
  note: string;
  onDelete: () => void;
}) {
  const text = useBuilderText();
  const [isAsking, setIsAsking] = useState(false);
  if (!isAsking) {
    return (
      <button
        type="button"
        onClick={() => setIsAsking(true)}
        className="self-start rounded-control px-1 py-0.5 text-caption font-medium text-danger hover:underline focus-visible:focus-ring"
      >
        {text("pageBuilder.siteStyles.deleteVariable")}
      </button>
    );
  }
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-control bg-fill/70 p-2.5">
      <p className="text-caption text-label">
        <span className="font-semibold">
          {text("pageBuilder.siteStyles.confirmDelete", { name })}
        </span>{" "}
        {note}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-control bg-danger px-2.5 py-1 text-caption font-medium text-white focus-visible:focus-ring"
        >
          {text("pageBuilder.siteStyles.deleteVariable")}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => setIsAsking(false)}
          className="rounded-control bg-fill px-2.5 py-1 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          {text("pageBuilder.siteStyles.keep")}
        </button>
      </div>
    </div>
  );
}

function SharedStyleRow({
  sharedStyle,
  look,
  uses,
  isOpen,
  onToggle,
  canChange,
  onSelect,
  onRename,
  onDelete,
}: {
  sharedStyle: SharedStyle;
  /** How it looks: for a variant, its base's look with its own over it. */
  look: SharedStyle;
  uses: number;
  isOpen: boolean;
  onToggle: () => void;
  canChange: boolean;
  onSelect?: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const text = useBuilderText();
  const isVariant = sharedStyle.variantOf !== undefined;
  const showsEditor = canChange || (onSelect !== undefined && uses > 0);
  return (
    <Row
      preview={
        <span className={classNames("flex shrink-0", isVariant && "ps-5")}>
          <SharedStylePreview sharedStyle={look} />
        </span>
      }
      name={sharedStyle.name}
      uses={uses > 0 ? text("pageBuilder.shared.uses", { count: uses }) : null}
      isOpen={isOpen}
      onToggle={showsEditor ? onToggle : undefined}
    >
      {onSelect && uses > 0 && (
        <button
          type="button"
          onClick={onSelect}
          className="flex h-8 items-center justify-center gap-1.5 rounded-control bg-fill px-3 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
        >
          <MousePointerClick aria-hidden="true" className="size-3.5" />
          {text("pageBuilder.siteStyles.selectThem")}
        </button>
      )}
      {canChange && <NameInput name={sharedStyle.name} onChange={onRename} />}
      {canChange && (
        <DeleteAction
          name={sharedStyle.name}
          note={text("pageBuilder.siteStyles.deleteShared")}
          onDelete={onDelete}
        />
      )}
    </Row>
  );
}
