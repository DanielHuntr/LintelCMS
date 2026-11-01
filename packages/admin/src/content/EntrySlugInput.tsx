import { useId } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

interface EntrySlugInputProps {
  /** The collection's route pattern, e.g. "/blog/{slug}". */
  routePattern: string;
  slug: string;
  onChange: (slug: string) => void;
  error: string | undefined;
}

/**
 * "URL: /blog/my-post" under the title. The slug part is an input that looks like text until
 * you hover or focus it, so the address is visible without adding another box to the form.
 */
export function EntrySlugInput({ routePattern, slug, onChange, error }: EntrySlugInputProps) {
  const inputId = useId();
  const errorId = useId();
  const [prefix = "", suffix = ""] = routePattern.includes("{slug}")
    ? routePattern.split("{slug}")
    : [routePattern.replace(/\/?$/, "/"), ""];

  return (
    <div data-field-handle="slug" className="flex flex-col gap-1">
      <p className="flex min-w-0 items-center text-footnote text-label-secondary">
        <label htmlFor={inputId} className="mr-1.5 shrink-0 font-medium text-label-secondary">
          {t("editor.url")}
        </label>
        <span aria-hidden="true" className="shrink-0">
          {prefix}
        </span>
        <input
          id={inputId}
          type="text"
          value={slug}
          placeholder={t("editor.slugPlaceholder")}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={classNames(
            "min-w-12 rounded-[5px] bg-transparent px-0.5 text-label [field-sizing:content]",
            "transition-colors duration-150 ease-standard hover:bg-fill focus:bg-fill",
            "placeholder:text-label-tertiary focus:outline-none focus-visible:focus-ring",
            error && "text-danger",
          )}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </p>
      {error && (
        <p id={errorId} className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
