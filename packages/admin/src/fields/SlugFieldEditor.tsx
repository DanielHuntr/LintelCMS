import { useEffect, useRef } from "react";
import { cleanTypedSlug, slugFromTitle } from "../content/slug.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { useSiblingValue } from "./FieldGrid.js";
import { textValue } from "./fieldValues.js";

/**
 * A web-friendly name, made from another field (the title unless the field says otherwise)
 * as it is typed, until someone edits the slug themselves.
 */
export function SlugFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const source = textValue(useSiblingValue(field.options.from ?? "title"));
  const slug = textValue(value);
  const previousSource = useRef(source);

  useEffect(() => {
    const followsSource = slug === "" || slug === slugFromTitle(previousSource.current);
    previousSource.current = source;
    if (followsSource && slugFromTitle(source) !== slug) {
      onChange(slugFromTitle(source) || null);
    }
    // Only a change to the source should move the slug; the slug is read as it was then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <input
      id={controlId}
      type="text"
      value={slug}
      placeholder={field.placeholder}
      spellCheck={false}
      autoCapitalize="off"
      onChange={(event) => onChange(cleanTypedSlug(event.target.value) || null)}
      onBlur={() => {
        const tidy = slugFromTitle(slug);
        if (tidy !== slug) onChange(tidy || null);
      }}
      aria-required={field.required || undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={describedBy}
      className={classNames("h-10 font-mono text-footnote", controlClasses({ hasError }))}
    />
  );
}
