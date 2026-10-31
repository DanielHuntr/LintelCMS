import { useId, useState, type Ref } from "react";
import { classNames } from "../design/classNames.js";
import { setupCodeGroupLength, setupCodeLength } from "./setupCode.js";

interface SetupCodeInputProps {
  label: string;
  value: string;
  onValueChange: (code: string) => void;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * The setup code as two groups of boxes, like a verification code on a phone. Underneath it is
 * one ordinary input stretched over the boxes, so pasting, autofill and screen readers behave
 * as they do in any text field; the boxes only draw what it holds.
 */
export function SetupCodeInput({ label, value, onValueChange, error, ref }: SetupCodeInputProps) {
  const inputId = useId();
  const errorId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const characters = Array.from({ length: setupCodeLength }, (_, index) => value[index] ?? "");
  const groups = [
    characters.slice(0, setupCodeGroupLength),
    characters.slice(setupCodeGroupLength),
  ];

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-footnote font-medium text-label-secondary">
        {label}
      </label>
      <div className="relative w-fit">
        <input
          id={inputId}
          ref={ref}
          value={value}
          onChange={(event) => onValueChange(normaliseSetupCode(event.target.value))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="one-time-code"
          inputMode="numeric"
          autoCorrect="off"
          spellCheck={false}
          // Room for a pasted separator such as "4821-0937" before it is stripped.
          maxLength={setupCodeLength + 2}
          className="absolute inset-0 z-10 cursor-text opacity-0"
        />
        <div aria-hidden="true" className="flex items-center gap-1.5 sm:gap-3">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="flex items-center gap-1.5 sm:gap-3">
              {groupIndex > 0 && <span className="h-0.5 w-3 rounded-full bg-label-tertiary" />}
              {group.map((character, indexInGroup) => {
                const index = groupIndex * setupCodeGroupLength + indexInGroup;
                const isNext = isFocused && index === Math.min(value.length, setupCodeLength - 1);
                return (
                  <span
                    key={index}
                    className={classNames(
                      "flex h-12 w-8 items-center justify-center rounded-control bg-fill",
                      "sm:h-16 sm:w-12 sm:rounded-card",
                      "text-[1.375rem] font-medium text-label tabular-nums sm:text-[1.75rem]",
                      "transition-shadow duration-150 ease-standard",
                      isNext && "focus-ring outline-offset-0",
                      error && !isNext && "ring-1 ring-danger",
                    )}
                  >
                    {character}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-footnote text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Digits only, so "4821 0937" and "4821-0937" (as the terminal shows it) both become "48210937". */
export function normaliseSetupCode(typed: string): string {
  return typed.replace(/\D/g, "").slice(0, setupCodeLength);
}
