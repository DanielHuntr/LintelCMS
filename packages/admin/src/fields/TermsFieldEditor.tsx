import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { createTerm } from "../taxonomies/taxonomies.api.js";
import { taxonomyKeys, useTerms } from "../taxonomies/taxonomies.queries.js";
import type { Term } from "../taxonomies/taxonomies.types.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { stringListFromItems, stringListValue } from "./fieldValues.js";

/**
 * Terms from a taxonomy, such as a post's categories or tags. One term is a native select;
 * several are pills to switch on and off. People who look after terms can add a new one
 * here without leaving the entry.
 */
export function TermsFieldEditor(props: FieldEditorProps) {
  const { field } = props;
  const terms = useTerms(field.options.taxonomy);

  if (terms.isPending) {
    return <Skeleton className="h-9 w-64" />;
  }
  if (terms.isError) {
    return <p className="text-footnote text-danger">{describeError(terms.error)}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {field.options.maxItems === 1 ? (
        <SingleTerm {...props} terms={terms.data} />
      ) : (
        <SeveralTerms {...props} terms={terms.data} />
      )}
      <NewTermForm {...props} />
    </div>
  );
}

type TermChoiceProps = FieldEditorProps & { terms: Term[] };

function SingleTerm({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
  terms,
}: TermChoiceProps) {
  const [selected = ""] = stringListValue(value);
  return (
    <div className="relative max-w-sm">
      <select
        id={controlId}
        value={selected}
        onChange={(event) => onChange(event.target.value === "" ? null : [event.target.value])}
        aria-required={field.required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={classNames("h-10 appearance-none pe-9", controlClasses({ hasError }))}
      >
        <option value="" disabled={field.required}>
          {field.required ? t("fields.select.choose") : t("fields.select.none")}
        </option>
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.title}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
      />
    </div>
  );
}

function SeveralTerms({ field, value, onChange, controlId, terms }: TermChoiceProps) {
  const selected = stringListValue(value);
  const { maxItems } = field.options;
  const isFull = maxItems !== undefined && selected.length >= maxItems;

  if (terms.length === 0) {
    return <p className="text-footnote text-label-secondary">{t("fields.terms.none")}</p>;
  }

  function toggle(termId: string) {
    const next = selected.includes(termId)
      ? selected.filter((id) => id !== termId)
      : [...selected, termId];
    onChange(stringListFromItems(next));
  }

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {terms.map((term, index) => {
          const isChecked = selected.includes(term.id);
          const isDisabled = !isChecked && isFull;
          return (
            <li key={term.id}>
              <label
                className={classNames(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-footnote font-medium select-none",
                  "transition-colors duration-150 ease-standard has-[:focus-visible]:focus-ring",
                  isChecked ? "bg-accent/14 text-accent" : "bg-fill text-label-secondary",
                  isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-label",
                )}
              >
                <input
                  id={index === 0 ? controlId : undefined}
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => toggle(term.id)}
                  className="sr-only"
                />
                {isChecked && <Check aria-hidden="true" strokeWidth={2.5} className="size-3.5" />}
                {term.title}
              </label>
            </li>
          );
        })}
      </ul>
      {isFull && (
        <p className="text-footnote text-label-secondary">
          {t("fields.terms.full", { count: maxItems })}
        </p>
      )}
    </>
  );
}

/** "Add a term": creates it in the taxonomy and chooses it straight away. */
function NewTermForm({ field, value, onChange }: FieldEditorProps) {
  const canAdd = useCan("terms:update");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const taxonomy = field.options.taxonomy;
  const selected = stringListValue(value);
  const isFull = field.options.maxItems !== undefined && selected.length >= field.options.maxItems;

  if (!canAdd || !taxonomy || (isFull && field.options.maxItems !== 1)) return null;

  async function add() {
    if (title.trim() === "" || !taxonomy) return;
    setIsAdding(true);
    setProblem(null);
    try {
      const term = await createTerm(taxonomy, { title: title.trim() });
      await queryClient.invalidateQueries({ queryKey: taxonomyKeys.taxonomy(taxonomy) });
      onChange(field.options.maxItems === 1 ? [term.id] : [...selected, term.id]);
      setTitle("");
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex max-w-sm items-center gap-2">
        <input
          aria-label={t("fields.terms.newLabel", { label: field.label })}
          placeholder={t("fields.terms.newPlaceholder")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
          className={classNames("h-8 text-footnote", controlClasses())}
        />
        <Button
          variant="tinted"
          size="small"
          icon={<Plus aria-hidden="true" />}
          onClick={() => void add()}
          disabled={isAdding || title.trim() === ""}
        >
          {t("fields.terms.add")}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-footnote text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
