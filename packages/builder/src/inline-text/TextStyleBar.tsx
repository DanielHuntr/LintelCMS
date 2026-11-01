import {
  fontFamilyValue,
  fontTokens,
  type MarkStyleProperty,
  type PageFont,
  pageFontFamily,
  sharedMarkStyles,
  type TextMark,
  tokenValue,
} from "@lintel/builder-model";
import { Bold, Eraser, Italic, Type } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/controls.js";

export type MarkChange = Partial<Record<MarkStyleProperty, string | undefined>>;

interface TextStyleBarProps {
  /** The selected part, in characters of the text. */
  from: number;
  to: number;
  marks: readonly TextMark[];
  pageFonts: readonly PageFont[];
  /** Applies styles to the selected part; null takes them all off. `label` names the change. */
  onApply: (styles: MarkChange | null, label: string) => void;
  disabled?: boolean;
}

const sizes = ["0.75em", "1.25em", "1.5em", "2em"] as const;
const highlight = "#fff3a3";

/**
 * Styles for the selected words of a heading or paragraph: italic, bold, outlined letters,
 * a colour, a highlight, another font or size, and "Clear" to take them off. Shown above the
 * canvas while words are selected on it, and under the text in the Content panel. Buttons
 * show as pressed when the whole selection already has that style.
 */
export function TextStyleBar({ from, to, marks, pageFonts, onApply, disabled }: TextStyleBarProps) {
  const text = useBuilderText();
  const colourId = useId();
  const highlightId = useId();
  const fontId = useId();
  const sizeId = useId();
  const shared = sharedMarkStyles(marks, Math.min(from, to), Math.max(from, to));
  const toggle = (styles: MarkChange, isOn: boolean, label: string) =>
    onApply(
      isOn ? Object.fromEntries(Object.keys(styles).map((name) => [name, undefined])) : styles,
      label,
    );
  const fonts = [
    ...fontTokens.map((token) => ({ value: tokenValue(token), label: token.label })),
    ...pageFonts.map((font) => ({ value: fontFamilyValue(font), label: pageFontFamily(font) })),
  ];
  const isItalic = shared.fontStyle === "italic";
  const isBold = shared.fontWeight === "700";
  const isOutlined = shared.textStroke !== undefined;

  return (
    <div
      role="toolbar"
      aria-label={text("pageBuilder.inlineText.toolbar")}
      className="flex flex-wrap items-center gap-1.5"
    >
      <ToolbarToggle
        label={text("pageBuilder.inlineText.italic")}
        icon={<Italic aria-hidden="true" className="size-4" />}
        pressed={isItalic}
        disabled={disabled}
        onClick={() =>
          toggle({ fontStyle: "italic" }, isItalic, text("pageBuilder.inlineText.italic"))
        }
      />
      <ToolbarToggle
        label={text("pageBuilder.inlineText.bold")}
        icon={<Bold aria-hidden="true" className="size-4" />}
        pressed={isBold}
        disabled={disabled}
        onClick={() => toggle({ fontWeight: "700" }, isBold, text("pageBuilder.inlineText.bold"))}
      />
      <ToolbarToggle
        label={text("pageBuilder.inlineText.outline")}
        icon={<Type aria-hidden="true" className="size-4" />}
        pressed={isOutlined}
        disabled={disabled}
        onClick={() =>
          toggle(
            { textStroke: "1px currentColor", textFillColor: "transparent" },
            isOutlined,
            text("pageBuilder.inlineText.outline"),
          )
        }
      />
      <label
        htmlFor={colourId}
        className="flex items-center gap-1 text-caption text-label-secondary"
      >
        {text("pageBuilder.inlineText.colour")}
        <input
          id={colourId}
          type="color"
          disabled={disabled}
          value={/^#[0-9a-f]{6}$/i.test(shared.color ?? "") ? shared.color : "#000000"}
          onChange={(event) =>
            onApply({ color: event.target.value }, text("pageBuilder.inlineText.colour"))
          }
          className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
      </label>
      <label
        htmlFor={highlightId}
        className="flex items-center gap-1 text-caption text-label-secondary"
      >
        <input
          id={highlightId}
          type="checkbox"
          disabled={disabled}
          checked={shared.backgroundColor !== undefined}
          onChange={(event) =>
            onApply(
              { backgroundColor: event.target.checked ? highlight : undefined },
              text("pageBuilder.inlineText.highlight"),
            )
          }
          className="size-4 accent-[var(--color-accent-fill)]"
        />
        {text("pageBuilder.inlineText.highlight")}
      </label>
      <label htmlFor={fontId} className="sr-only">
        {text("pageBuilder.inlineText.font")}
      </label>
      <select
        id={fontId}
        disabled={disabled}
        value={shared.fontFamily ?? ""}
        onChange={(event) =>
          onApply(
            { fontFamily: event.target.value || undefined },
            text("pageBuilder.inlineText.font"),
          )
        }
        className="h-7 max-w-36 rounded-control bg-fill px-1.5 text-caption text-label focus-visible:focus-ring"
      >
        <option value="">{text("pageBuilder.inlineText.sameFont")}</option>
        {fonts.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <label htmlFor={sizeId} className="sr-only">
        {text("pageBuilder.inlineText.size")}
      </label>
      <select
        id={sizeId}
        disabled={disabled}
        value={shared.fontSize ?? ""}
        onChange={(event) =>
          onApply(
            { fontSize: event.target.value || undefined },
            text("pageBuilder.inlineText.size"),
          )
        }
        className="h-7 rounded-control bg-fill px-1.5 text-caption text-label focus-visible:focus-ring"
      >
        <option value="">{text("pageBuilder.inlineText.sameSize")}</option>
        {sizes.map((size) => (
          <option key={size} value={size}>
            {text(`pageBuilder.inlineText.size.${size}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onApply(null, text("pageBuilder.inlineText.clear"))}
        className="flex h-7 items-center gap-1 rounded-control px-2 text-caption font-medium text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring disabled:opacity-40"
      >
        <Eraser aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.inlineText.clear")}
      </button>
    </div>
  );
}

function ToolbarToggle({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        "flex size-7 items-center justify-center rounded-control focus-visible:focus-ring disabled:opacity-40",
        pressed ? "bg-accent-fill text-on-accent" : "bg-fill text-label hover:bg-fill-strong",
      )}
    >
      {icon}
    </button>
  );
}
