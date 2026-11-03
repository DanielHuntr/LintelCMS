import { Button, controlClasses, type FieldEditorProps } from "@lintel/admin/plugin";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { normaliseHex, readableTextColour } from "../shared/colours.js";
import { t } from "./strings.js";

type Colour = [name: string, hex: string];

/** Colours offered for new rows, in turn, when the field doesn't fix a set of choices. */
const STARTING_COLOURS = ["#1a7f5a", "#f2c14e", "#2d5d9f", "#e07a5f", "#3d405b", "#f4f1de"];

/**
 * The Colour palette field: the colours in order, each with a name. A colour is picked with
 * the browser's own colour picker, or from the field's fixed choices when it has some.
 * Moving is with buttons rather than dragging, so it works from the keyboard.
 */
export function PaletteEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
}: FieldEditorProps) {
  const colours = readColours(value);
  const { maxColours, choices } = readOptions(field.options);
  const isFull = colours.length >= maxColours;

  const save = (next: Colour[]) => onChange(next.length === 0 ? null : next);
  const update = (index: number, colour: Colour) =>
    save(colours.map((existing, position) => (position === index ? colour : existing)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...colours];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    save(next);
  };
  const add = () => {
    const unused = STARTING_COLOURS.find((hex) => !colours.some(([, used]) => used === hex));
    save([...colours, [t("palette.newName", { number: colours.length + 1 }), unused ?? "#888888"]]);
  };

  return (
    <div id={controlId} aria-describedby={describedBy} className="flex flex-col gap-3">
      {choices.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-footnote text-label-secondary">{t("palette.choose")}</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map(([name, hex]) => {
              const isChosen = colours.some(([, used]) => used === hex);
              return (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={isChosen}
                  aria-label={t("palette.choice", { name, hex })}
                  title={name}
                  disabled={!isChosen && isFull}
                  onClick={() =>
                    save(
                      isChosen
                        ? colours.filter(([, used]) => used !== hex)
                        : [...colours, [name, hex]],
                    )
                  }
                  className="grid size-9 place-items-center rounded-full focus-visible:focus-ring disabled:opacity-40"
                  style={{
                    background: hex,
                    color: readableTextColour(hex),
                    boxShadow: isChosen
                      ? "0 0 0 2px var(--color-background, #fff), 0 0 0 4px var(--color-accent, #0a66d8)"
                      : "inset 0 0 0 1px rgb(0 0 0 / 0.15)",
                  }}
                >
                  {isChosen && <Check aria-hidden className="size-4" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {colours.length === 0 ? (
        <p className="text-footnote text-label-secondary">{t("palette.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {colours.map(([name, hex], index) => {
            const label = name.trim() || hex;
            return (
              <li key={index} className="flex items-center gap-2">
                <span
                  className="relative size-9 shrink-0 overflow-hidden rounded-full"
                  style={{ background: hex, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.15)" }}
                >
                  {choices.length === 0 && (
                    <input
                      type="color"
                      aria-label={t("palette.colour", { name: label })}
                      value={hex}
                      onChange={(event) =>
                        update(index, [name, normaliseHex(event.target.value) ?? hex])
                      }
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  )}
                </span>
                <input
                  type="text"
                  aria-label={t("palette.name")}
                  value={name}
                  maxLength={40}
                  onChange={(event) => update(index, [event.target.value, hex])}
                  className={`${controlClasses()} h-9 min-w-0 flex-1`}
                />
                <span className="hidden w-16 font-mono text-footnote text-label-secondary sm:inline">
                  {hex}
                </span>
                <IconButton
                  label={t("palette.moveUp", { name: label })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  label={t("palette.moveDown", { name: label })}
                  disabled={index === colours.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </IconButton>
                <IconButton
                  label={t("palette.remove", { name: label })}
                  onClick={() => save(colours.filter((_, position) => position !== index))}
                >
                  <X aria-hidden className="size-4" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}

      {choices.length === 0 &&
        (isFull ? (
          <p className="text-footnote text-label-secondary">{t("palette.full")}</p>
        ) : (
          <Button
            type="button"
            variant="tinted"
            size="small"
            className="self-start"
            icon={<Plus aria-hidden />}
            onClick={add}
          >
            {t("palette.add")}
          </Button>
        ))}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** The stored rows, or delivered objects if an older value has them; others are skipped. */
function readColours(value: unknown): Colour[] {
  if (!Array.isArray(value)) return [];
  const colours: Colour[] = [];
  for (const item of value) {
    if (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string") {
      colours.push([item[0], normaliseHex(item[1]) ?? "#888888"]);
    } else if (typeof item === "object" && item !== null && "name" in item && "hex" in item) {
      const { name, hex } = item;
      if (typeof name === "string" && typeof hex === "string") {
        colours.push([name, normaliseHex(hex) ?? "#888888"]);
      }
    }
  }
  return colours;
}

function readOptions(options: object): { maxColours: number; choices: Colour[] } {
  const maxColours =
    "maxColours" in options && typeof options.maxColours === "number" ? options.maxColours : 12;
  const choices: Colour[] = [];
  const offered = "choices" in options && Array.isArray(options.choices) ? options.choices : [];
  for (const choice of offered as unknown[]) {
    if (typeof choice !== "object" || choice === null) continue;
    const name = "name" in choice ? choice.name : undefined;
    const hex = "hex" in choice && typeof choice.hex === "string" ? normaliseHex(choice.hex) : null;
    if (typeof name === "string" && hex) choices.push([name, hex]);
  }
  return { maxColours, choices };
}
