import { createContext, useContext } from "react";
import { t } from "../i18n/strings.js";
import type { PersonAtWork } from "./useLiveActivity.js";

/** The others on the page, for fields to say who is typing in them. */
export const FieldPeopleContext = createContext<readonly PersonAtWork[]>([]);

/** The field an element belongs to, for telling others where this person is. */
export function fieldBeingEdited(element: Element): string | null {
  return element.closest("[data-field-handle]")?.getAttribute("data-field-handle") ?? null;
}

/** A quiet line on a field while someone else is typing in it. */
export function FieldPerson({ handle }: { handle: string }) {
  const person = useContext(FieldPeopleContext).find((each) => each.field === handle);
  if (!person) return null;
  return (
    <p className="flex items-center gap-1.5 text-caption text-label-secondary">
      <span
        aria-hidden="true"
        style={{ backgroundColor: person.colour }}
        className="size-2 rounded-full"
      />
      {t("collab.editingField", { name: person.name })}
    </p>
  );
}
