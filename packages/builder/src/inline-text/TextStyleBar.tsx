import {
  fontFamilyValue,
  fontTokens,
  isSafeLinkAddress,
  type MarkChange,
  type PageFont,
  pageFontFamily,
  sharedMarkLink,
  sharedMarkStyles,
  type TextMark,
  tokenValue,
} from "@lintel/builder-model";
import { Bold, Eraser, Italic, Link, Type } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/controls.js";
import { isToggleOn, toggleChange } from "./markToggles.js";

export type { MarkChange } from "@lintel/builder-model";

interface TextStyleBarProps {
  /** The selected part, in characters of the text. */
  from: number;
  to: number;
  marks: readonly TextMark[];
  pageFonts: readonly PageFont[];
  /** Applies styles to the selected part; null takes them all off. `label` names the change. */
  onApply: (styles: MarkChange | null, label: string) => void;
  disabled?: boolean;
  /** Goes up each time Mod+K asks for a link, which opens the address box. */
  linkRequest?: number;
}

const sizes = ["0.75em", "1.25em", "1.5em", "2em"] as const;
const highlight = "#fff3a3";

/**
 * Styles for the selected words of a heading or paragraph: italic, bold, outlined letters,
 * a colour, a highlight, another font or size, and "Clear" to take them off. Shown above the
 * canvas while words are selected on it, and under the text in the Content panel. Buttons
 * show as pressed when the whole selection already has that style.
 */
export function TextStyleBar({
  from,
  to,
  marks,
  pageFonts,
  onApply,
  disabled,
  linkRequest = 0,
}: TextStyleBarProps) {
  const text = useBuilderText();
  const colourId = useId();
  const highlightId = useId();
  const fontId = useId();
  const sizeId = useId();
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const shared = sharedMarkStyles(marks, start, end);
  const link = sharedMarkLink(marks, start, end);
  const [isLinking, setIsLinking] = useState(false);
  const [seenLinkRequest, setSeenLinkRequest] = useState(linkRequest);
  // Adjusting state during render when a prop changes, as the React docs recommend.
  if (linkRequest !== seenLinkRequest) {
    setSeenLinkRequest(linkRequest);
    if (!disabled) setIsLinking(true);
  }
  const fonts = [
    ...fontTokens.map((token) => ({ value: tokenValue(token), label: token.label })),
    ...pageFonts.map((font) => ({ value: fontFamilyValue(font), label: pageFontFamily(font) })),
  ];
  const isItalic = isToggleOn(marks, start, end, "italic");
  const isBold = isToggleOn(marks, start, end, "bold");
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
          onApply(toggleChange(marks, start, end, "italic"), text("pageBuilder.inlineText.italic"))
        }
      />
      <ToolbarToggle
        label={text("pageBuilder.inlineText.bold")}
        icon={<Bold aria-hidden="true" className="size-4" />}
        pressed={isBold}
        disabled={disabled}
        onClick={() =>
          onApply(toggleChange(marks, start, end, "bold"), text("pageBuilder.inlineText.bold"))
        }
      />
      <ToolbarToggle
        label={
          link ? text("pageBuilder.inlineText.removeLink") : text("pageBuilder.inlineText.link")
        }
        icon={<Link aria-hidden="true" className="size-4" />}
        pressed={link !== undefined}
        disabled={disabled}
        onClick={() =>
          link
            ? onApply({ href: undefined }, text("pageBuilder.inlineText.removeLink"))
            : setIsLinking(!isLinking)
        }
      />
      <ToolbarToggle
        label={text("pageBuilder.inlineText.outline")}
        icon={<Type aria-hidden="true" className="size-4" />}
        pressed={isOutlined}
        disabled={disabled}
        onClick={() =>
          onApply(
            isOutlined
              ? { textStroke: undefined, textFillColor: undefined }
              : { textStroke: "1px currentColor", textFillColor: "transparent" },
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
      {isLinking && !link && (
        <LinkAddressBox
          onAdd={(address) => {
            setIsLinking(false);
            onApply({ href: address }, text("pageBuilder.inlineText.link"));
          }}
          onCancel={() => setIsLinking(false)}
        />
      )}
    </div>
  );
}

/** Where the selected words should link to: a page address, a web address, mail or phone. */
function LinkAddressBox({
  onAdd,
  onCancel,
}: {
  onAdd: (address: string) => void;
  onCancel: () => void;
}) {
  const text = useBuilderText();
  const inputId = useId();
  const [address, setAddress] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = address.trim();
    if (trimmed === "" || !isSafeLinkAddress(trimmed)) {
      setProblem(text("pageBuilder.inlineText.linkProblem"));
      return;
    }
    onAdd(trimmed);
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-wrap items-center gap-1.5">
      <label htmlFor={inputId} className="text-caption text-label-secondary">
        {text("pageBuilder.inlineText.linkAddress")}
      </label>
      <input
        id={inputId}
        // Mod+K or the button asked for it, so typing goes straight in.
        autoFocus
        value={address}
        placeholder="/contact"
        aria-invalid={problem !== null}
        aria-describedby={problem ? `${inputId}-problem` : undefined}
        onChange={(event) => {
          setAddress(event.target.value);
          setProblem(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        className="h-7 min-w-40 flex-1 rounded-control bg-fill px-2 text-caption text-label focus-visible:focus-ring"
      />
      <button
        type="submit"
        className="h-7 rounded-control bg-accent-fill px-2.5 text-caption font-semibold text-on-accent focus-visible:focus-ring"
      >
        {text("pageBuilder.inlineText.addLink")}
      </button>
      {problem && (
        <p id={`${inputId}-problem`} role="alert" className="w-full text-caption text-danger">
          {problem}
        </p>
      )}
    </form>
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
