import {
  type DesignToken,
  findTokenByValue,
  isDesignVariableValue,
  type StylePropertyName,
  tokenValue,
  variableValue,
} from "@lintel/builder-model";
import { Check } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { addVariable, useSiteDesign, useSiteTokens } from "../site-design/site-design-context.js";
import { classNames, inputClassName, Labelled } from "../ui/controls.js";
import { friendlyLength } from "./style-summaries.js";
import {
  normaliseTypedValue,
  overrideNoteFor,
  useStyleEditing,
  useStyleField,
} from "./style-field.js";

/** The controls the Style panel is made of. Each edits one property (or a few together). */

interface StyleControlProps {
  property: StylePropertyName;
  label: string;
}

/** Shows the dot and Reset when the value is changed for this screen size or state. */
function useOverrideNote(isOverridden: boolean) {
  const text = useBuilderText();
  const { target } = useStyleEditing();
  return isOverridden ? text(overrideNoteFor(target)) : undefined;
}

/** Properties that take a size, so the site's named sizes are offered for them. */
const sizeProperties = new Set<StylePropertyName>([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "top",
  "right",
  "bottom",
  "left",
  "fontSize",
  "letterSpacing",
  "borderRadius",
  "borderWidth",
]);

/**
 * Free text, applied on Enter or when leaving the box. Bare numbers become pixels. For sizes,
 * the site's named sizes are offered first: one in use shows as its name, linked, and a size
 * typed by hand can be saved as one.
 */
export function StyleTextInput({
  property,
  label,
  placeholder,
}: StyleControlProps & { placeholder?: string }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const [draft, setDraft] = useState(field.value ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const errorId = useId();
  const siteSizes = useSiteTokens("size");
  const takesSize = sizeProperties.has(property);
  const linked = takesSize ? findTokenByValue(field.value, siteSizes) : undefined;
  // When the value changes from outside (undo, another screen size), show the new one.
  const [shownValue, setShownValue] = useState(field.value);
  if (shownValue !== field.value) {
    setShownValue(field.value);
    setDraft(field.value ?? "");
  }

  const commit = () => {
    const value = normaliseTypedValue(property, draft);
    if (value === null) {
      setProblem(text("pageBuilder.style.invalidValue"));
      return;
    }
    setProblem(null);
    if (value !== field.value) field.set(value);
  };

  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) =>
        linked ? (
          <LinkedValue id={id} name={linked.label} onUnlink={() => field.set(linked.fallback)} />
        ) : (
          <div className="group flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                id={id}
                value={draft}
                placeholder={placeholder ?? text("pageBuilder.style.auto")}
                aria-invalid={problem !== null}
                aria-describedby={problem ? errorId : undefined}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit();
                  if (event.key === "Escape") setDraft(field.value ?? "");
                }}
                className={classNames(
                  inputClassName,
                  "min-w-0 flex-1",
                  problem && "focus-ring-danger",
                )}
              />
              {takesSize && siteSizes.length > 0 && (
                <select
                  aria-label={text("pageBuilder.siteStyles.useSize", { label })}
                  value=""
                  onChange={(event) => {
                    const token = siteSizes.find((each) => each.name === event.target.value);
                    if (token) field.set(tokenValue(token));
                  }}
                  className={`${inputClassName} w-16 shrink-0 cursor-pointer`}
                >
                  <option value="">{text("pageBuilder.siteStyles.sizesMenu")}</option>
                  {siteSizes.map((token) => (
                    <option key={token.name} value={token.name}>
                      {token.label} ({token.fallback})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {problem && (
              <span id={errorId} className="text-caption text-danger">
                {problem}
              </span>
            )}
            {takesSize && field.value && !problem && isDesignVariableValue("size", field.value) && (
              <SaveAsVariable
                kind="size"
                value={field.value}
                onSaved={field.set}
                className="hidden group-focus-within:block group-hover:block"
              />
            )}
          </div>
        )
      }
    </Labelled>
  );
}

/** A value that is one of the site's named styles: its name, and a way to unlink it. */
function LinkedValue({ id, name, onUnlink }: { id: string; name: string; onUnlink: () => void }) {
  const text = useBuilderText();
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-control bg-fill px-2">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent-fill" />
      <output id={id} className="min-w-0 flex-1 truncate text-footnote text-label">
        {name}
      </output>
      <button
        type="button"
        onClick={onUnlink}
        className="rounded px-1 text-caption text-accent hover:underline focus-visible:focus-ring"
      >
        {text("pageBuilder.siteStyles.unlink")}
      </button>
    </div>
  );
}

/** A dropdown of fixed choices, with "Not set" first. */
export function StyleSelect({
  property,
  label,
  choices,
}: StyleControlProps & { choices: readonly { value: string; label: string }[] }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const known = choices.some((choice) => choice.value === field.value);
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <select
          id={id}
          value={field.value ?? ""}
          onChange={(event) => field.set(event.target.value || undefined)}
          className={inputClassName}
        >
          <option value="">{text("pageBuilder.style.notSet")}</option>
          {!known && field.value && <option value={field.value}>{field.value}</option>}
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )}
    </Labelled>
  );
}

interface ChipChoice {
  value: string | undefined;
  label: string;
}

/**
 * A row of one-tap choices ("None, S, M, L"): the friendly control Simple mode is made of.
 * `properties` lets one chip set several properties, such as padding on all four sides.
 */
export function StyleChips({
  properties,
  label,
  choices,
  lookValue = null,
}: {
  properties: readonly StylePropertyName[];
  label: string;
  choices: readonly ChipChoice[];
  /**
   * The choice that matches how the element looks on the canvas, shown pressed while nothing
   * is set on it. Null when the look isn't known or matches no choice.
   */
  lookValue?: string | undefined | null;
}) {
  const text = useBuilderText();
  const { change } = useStyleEditing();
  const first = useStyleField(properties[0] as StylePropertyName, label);
  const labelId = useId();
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(first.isOverridden)}
      onReset={() =>
        change(Object.fromEntries(properties.map((property) => [property, undefined])), label)
      }
      resetLabel={text("pageBuilder.style.reset")}
    >
      {() => (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1">
          <span id={labelId} className="sr-only">
            {label}
          </span>
          {choices.map((choice) => {
            // A value set here that no chip matches shows as "Custom" below, with no chip
            // pressed; with nothing set, the chip nearest how it looks is pressed.
            const isChipValue = choices.some((each) => each.value === first.value);
            const shown =
              first.value !== undefined ? (isChipValue ? first.value : null) : lookValue;
            const isCurrent = choice.value === shown;
            return (
              <button
                key={choice.label}
                type="button"
                aria-pressed={isCurrent}
                onClick={() =>
                  change(
                    Object.fromEntries(properties.map((property) => [property, choice.value])),
                    label,
                  )
                }
                className={classNames(
                  "h-7 rounded-control px-2.5 text-caption font-medium transition-colors duration-150 focus-visible:focus-ring",
                  isCurrent
                    ? "bg-accent-fill text-on-accent"
                    : "bg-fill text-label hover:bg-fill-strong",
                )}
              >
                {choice.label}
              </button>
            );
          })}
          {first.value !== undefined && !choices.some((each) => each.value === first.value) && (
            <span className="flex h-7 items-center rounded-control bg-accent-fill px-2.5 text-caption font-medium text-on-accent">
              {friendlyLength(first.value)
                ? text("pageBuilder.style.customValue", { value: friendlyLength(first.value)! })
                : text("pageBuilder.style.custom")}
            </span>
          )}
        </div>
      )}
    </Labelled>
  );
}

/** The site's own sizes, then the theme's spacing steps given, as chips. */
export function useSizeChips(tokens: readonly DesignToken[], noneLabel: string): ChipChoice[] {
  return tokenChips([...useSiteTokens("size"), ...tokens], noneLabel);
}

export function tokenChips(
  tokens: readonly DesignToken[],
  noneLabel: string,
  none = "0",
): ChipChoice[] {
  return [
    { value: none, label: noneLabel },
    ...tokens.map((token) => ({ value: tokenValue(token), label: token.label })),
  ];
}

/** The theme's colours as swatches, plus a custom colour. Names are spoken and shown on hover. */
export function ColourPicker({
  property,
  label,
  tokens: themeTokens,
}: StyleControlProps & { tokens: readonly DesignToken[] }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const labelId = useId();
  // The site's own colours first (see site-design/), then the theme's.
  const siteColours = useSiteTokens("colour");
  const tokens = [...siteColours, ...themeTokens];
  const current = findTokenByValue(field.value, tokens);
  const custom =
    field.value && !current && /^#[0-9a-f]{6}$/i.test(field.value) ? field.value : "#000000";
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-1.5">
          <span id={labelId} className="sr-only">
            {label}
          </span>
          {tokens.map((token, index) => {
            const isCurrent = current?.name === token.name;
            const startsTheme = index === siteColours.length && index > 0;
            return (
              <Fragment key={token.name}>
                {startsTheme && (
                  <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-separator" />
                )}
                <button
                  type="button"
                  title={token.label}
                  aria-label={token.label}
                  aria-pressed={isCurrent}
                  onClick={() => field.set(tokenValue(token))}
                  style={{ backgroundColor: token.fallback }}
                  className="flex size-6 items-center justify-center rounded-full hairline-ring focus-visible:focus-ring"
                >
                  {isCurrent && (
                    <Check
                      aria-hidden="true"
                      className="size-3.5 text-white mix-blend-difference"
                    />
                  )}
                </button>
              </Fragment>
            );
          })}
          <label className="flex items-center gap-1 text-caption text-label-secondary">
            <input
              id={id}
              type="color"
              value={custom}
              onChange={(event) => field.set(event.target.value)}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            {text("pageBuilder.style.customColour")}
          </label>
          {current && (
            // The swatches' names are only in tooltips, so the chosen one is named here too.
            <span
              aria-hidden="true"
              className="flex basis-full items-center gap-1.5 text-caption text-label-secondary"
            >
              {siteColours.includes(current) && (
                <span className="size-1.5 shrink-0 rounded-full bg-accent-fill" />
              )}
              {current.label}
            </span>
          )}
          {!current && field.value && isDesignVariableValue("colour", field.value) && (
            <SaveAsVariable kind="colour" value={field.value} onSaved={field.set} />
          )}
        </div>
      )}
    </Labelled>
  );
}

/**
 * "Save as a site colour" (or a size) under a value picked by hand: names it, adds it to the
 * site's styles and uses it here, so it can be picked anywhere and changed in one place.
 */
function SaveAsVariable({
  kind,
  value,
  onSaved,
  className,
}: {
  kind: "colour" | "size";
  value: string;
  onSaved: (value: string) => void;
  className?: string;
}) {
  const text = useBuilderText();
  const site = useSiteDesign();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  if (!site.change) return null;
  const change = site.change;
  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className={classNames(
          "basis-full self-start text-start text-caption font-medium text-accent hover:underline focus-visible:focus-ring",
          className,
        )}
      >
        {text(
          kind === "colour" ? "pageBuilder.site.saveColour" : "pageBuilder.siteStyles.saveSize",
        )}
      </button>
    );
  }
  const save = () => {
    if (!name.trim()) return;
    const added = addVariable(site.design, kind, name.trim().slice(0, 40), value);
    change(added.design);
    onSaved(variableValue(added.variable));
    setNaming(false);
    setName("");
  };
  const nameLabel = text(
    kind === "colour" ? "pageBuilder.site.colourName" : "pageBuilder.siteStyles.sizeName",
  );
  return (
    <span className="flex basis-full items-center gap-1">
      <input
        aria-label={nameLabel}
        placeholder={nameLabel}
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") setNaming(false);
        }}
        autoFocus
        className={`${inputClassName} min-w-0 flex-1`}
      />
      <button
        type="button"
        onClick={save}
        className="rounded-control bg-accent-fill px-2.5 py-1 text-caption font-medium text-white focus-visible:focus-ring"
      >
        {text("pageBuilder.shared.save")}
      </button>
    </span>
  );
}

/**
 * A slider for a number with a unit (degrees, percent, pixels), with the value shown beside
 * it. At `neutral` the property is cleared rather than stored, so untouched elements stay
 * clean. The arrow keys move it by `step`, as with any range input.
 */
export function StyleSlider({
  property,
  label,
  min,
  max,
  step,
  unit,
  neutral,
}: StyleControlProps & { min: number; max: number; step: number; unit: string; neutral: number }) {
  const text = useBuilderText();
  const field = useStyleField(property, label);
  const parsed = Number.parseFloat(field.value ?? "");
  const current = Number.isFinite(parsed) ? parsed : neutral;
  return (
    <Labelled
      label={label}
      overridden={useOverrideNote(field.isOverridden)}
      onReset={field.reset}
      resetLabel={text("pageBuilder.style.reset")}
    >
      {(id) => (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, current))}
            aria-valuetext={`${current}${unit}`}
            onChange={(event) => {
              const value = Number(event.target.value);
              field.set(value === neutral ? undefined : `${value}${unit}`);
            }}
            className="flex-1 accent-[var(--color-accent-fill)]"
          />
          <span className="w-12 text-end text-caption text-label-secondary">
            {current}
            {unit}
          </span>
        </div>
      )}
    </Labelled>
  );
}
