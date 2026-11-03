import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { splitList } from "./productDraft.js";

interface OptionChoicesFieldProps {
  label: string;
  placeholder: string;
  morePlaceholder: string;
  hint: string;
  error?: string;
  choices: readonly string[];
  onChange: (choices: string[]) => void;
  onRename: (from: string, to: string) => void;
}

/**
 * An option's choices as chips. A comma or Enter turns what's typed into a chip, and so does
 * leaving the box, so nothing typed is lost by going straight to Save. Pasting "S, M, L" makes
 * three. Selecting a chip's name changes its wording in place.
 */
export function OptionChoicesField({
  label,
  placeholder,
  morePlaceholder,
  hint,
  error,
  choices,
  onChange,
  onRename,
}: OptionChoicesFieldProps) {
  const inputId = useId();
  const messageId = useId();
  const [text, setText] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lastRemoveButton = useRef<HTMLButtonElement>(null);

  function add(typed: string) {
    const added = splitList(typed).filter((choice) => !choices.includes(choice));
    if (added.length === 0) return;
    onChange([...choices, ...added]);
    setAnnouncement(t("shop.products.choiceAdded", { name: added.join(", ") }));
  }

  function changeText(value: string) {
    const lastComma = value.lastIndexOf(",");
    if (lastComma === -1) {
      setText(value);
      return;
    }
    add(value.slice(0, lastComma));
    setText(value.slice(lastComma + 1).trimStart());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      // Enter would otherwise save the whole product.
      event.preventDefault();
      add(text);
      setText("");
    } else if (event.key === "Backspace" && text === "") {
      lastRemoveButton.current?.focus();
    }
  }

  function remove(choice: string) {
    onChange(choices.filter((existing) => existing !== choice));
    setAnnouncement(t("shop.products.choiceRemoved", { name: choice }));
    input.current?.focus();
  }

  function finishRenaming(from: string, typed: string) {
    setRenaming(null);
    const to = typed.replaceAll(",", " ").trim();
    if (to !== "" && !choices.includes(to) && choices.includes(from)) onRename(from, to);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-footnote font-medium text-label">
        {label}
      </label>
      {/* A click on the empty part of the box goes to the text box, as in any text field. */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) input.current?.focus();
        }}
        className={classNames(
          "flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-control bg-fill px-2 py-1.5",
          "transition-shadow duration-150 ease-standard focus-within:focus-ring focus-within:outline-offset-0",
          error && "ring-1 ring-danger",
        )}
      >
        {choices.length > 0 && (
          <ul className="contents">
            {choices.map((choice, index) => (
              <li key={choice} className="max-w-full">
                {renaming === choice ? (
                  <RenameBox
                    choice={choice}
                    onFinish={(typed) => finishRenaming(choice, typed)}
                    onCancel={() => setRenaming(null)}
                    onLeave={() => input.current?.focus()}
                  />
                ) : (
                  <span className="flex h-7 max-w-full items-center rounded-full bg-surface text-footnote text-label hairline-ring">
                    <button
                      type="button"
                      aria-label={t("shop.products.changeChoice", { name: choice })}
                      onClick={() => setRenaming(choice)}
                      className="min-w-0 truncate rounded-full ps-2.5 pe-1 leading-7 focus-visible:focus-ring"
                    >
                      {choice}
                    </button>
                    <button
                      type="button"
                      ref={index === choices.length - 1 ? lastRemoveButton : undefined}
                      aria-label={t("shop.products.removeChoice", { name: choice })}
                      onClick={() => remove(choice)}
                      onKeyDown={(event) => {
                        if (event.key === "Backspace" || event.key === "Delete") remove(choice);
                      }}
                      className="me-1 flex size-5 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
                    >
                      <X aria-hidden="true" strokeWidth={2.25} className="size-3" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          id={inputId}
          value={text}
          placeholder={choices.length > 0 ? morePlaceholder : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            add(text);
            setText("");
          }}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-body text-label outline-none placeholder:text-label-tertiary"
        />
      </div>
      <p
        id={messageId}
        className={classNames("text-footnote", error ? "text-danger" : "text-label-secondary")}
      >
        {error ?? hint}
      </p>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

interface RenameBoxProps {
  choice: string;
  onFinish: (typed: string) => void;
  onCancel: () => void;
  /** Called after Enter or Escape, when focus has to go somewhere else. */
  onLeave: () => void;
}

/** A chip being reworded. Leaving it keeps the change; Escape puts the old wording back. */
function RenameBox({ choice, onFinish, onCancel, onLeave }: RenameBoxProps) {
  const [typed, setTyped] = useState(choice);
  const box = useRef<HTMLInputElement>(null);
  const isDone = useRef(false);

  useEffect(() => box.current?.select(), []);

  function finish() {
    if (isDone.current) return;
    isDone.current = true;
    onFinish(typed);
  }

  return (
    <input
      ref={box}
      value={typed}
      aria-label={t("shop.products.changeChoice", { name: choice })}
      size={Math.max(typed.length, 3)}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish();
          onLeave();
        } else if (event.key === "Escape") {
          isDone.current = true;
          onCancel();
          onLeave();
        }
      }}
      className="h-7 max-w-full rounded-full bg-surface px-2.5 text-footnote text-label hairline-ring outline-none"
    />
  );
}
