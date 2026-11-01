import { useId, useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { slugFromTitle } from "../content/slug.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { Term, TermChanges } from "./taxonomies.types.js";

interface TermSheetProps {
  /** The term being edited, or null for a new one. */
  term: Term | null;
  taxonomyName: string;
  onSave: (changes: TermChanges) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

/** A term's name, slug and description. A new term's slug is made from its name. */
export function TermSheet({ term, taxonomyName, onSave, onDelete, onClose }: TermSheetProps) {
  const [title, setTitle] = useState(term?.title ?? "");
  const [slug, setSlug] = useState(term?.slug ?? "");
  const [description, setDescription] = useState(term?.description ?? "");
  const [problems, setProblems] = useState<{ title?: string; slug?: string; other?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (title.trim() === "") {
      setProblems({ title: t("terms.problem.title") });
      return;
    }
    setIsSaving(true);
    setProblems({});
    try {
      await onSave({ title: title.trim(), slug: slug.trim(), description: description.trim() });
    } catch (error) {
      const slugProblem = error instanceof ApiError ? error.fields?.slug : undefined;
      setProblems(slugProblem ? { slug: slugProblem } : { other: describeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={term ? term.title : t("terms.newTitle")}
      description={taxonomyName}
      footer={
        <>
          {onDelete && (
            <Button variant="destructive" className="me-auto" onClick={onDelete}>
              {t("terms.delete")}
            </Button>
          )}
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={isSaving}>
            {term ? t("terms.save") : t("terms.add")}
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5 pt-2 pb-1">
        {problems.other && (
          <p role="alert" className="rounded-card bg-danger/10 px-3 py-2 text-footnote text-label">
            {problems.other}
          </p>
        )}
        <TextField
          label={t("terms.name")}
          value={title}
          error={problems.title}
          data-autofocus
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextField
          label={t("terms.slug")}
          hint={t("terms.slugHint", { slug: slugFromTitle(title) || "news" })}
          value={slug}
          error={problems.slug}
          spellCheck={false}
          autoCapitalize="off"
          placeholder={slugFromTitle(title)}
          className="[&_input]:font-mono [&_input]:text-footnote"
          onChange={(event) => setSlug(event.target.value)}
        />
        <TermDescription value={description} onChange={setDescription} />
        {/* Lets Enter in a text field save, as in any form. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}

function TermDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-footnote font-medium text-label">
        {t("terms.description")}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={classNames("min-h-20 resize-y py-2", controlClasses())}
      />
      <p className="text-footnote text-label-secondary">{t("terms.descriptionHint")}</p>
    </div>
  );
}
