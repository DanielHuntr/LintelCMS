import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../api/client.js";
import { Avatar } from "../design/Avatar.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { listPeople } from "../people/people.api.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { stringListFromItems, stringListValue } from "./fieldValues.js";

/**
 * People with an account, ticked in a short list with a search box. With "only 1" allowed,
 * picking someone replaces whoever was chosen. Someone who can't see the list of people (it
 * needs the people permission) is told so rather than shown an empty list.
 */
export function UsersFieldEditor({ field, value, onChange, controlId }: FieldEditorProps) {
  const [query, setQuery] = useState("");
  const people = useQuery({ queryKey: ["people", "picker"], queryFn: () => listPeople("") });
  const chosen = stringListValue(value);
  const maxItems = field.options.maxItems;
  const isSingle = maxItems === 1;

  function toggle(personId: string) {
    if (chosen.includes(personId)) {
      onChange(stringListFromItems(chosen.filter((id) => id !== personId)));
    } else if (isSingle) {
      onChange([personId]);
    } else if (maxItems === undefined || chosen.length < maxItems) {
      onChange([...chosen, personId]);
    }
  }

  if (people.isPending) return <Skeleton className="h-24 rounded-card" />;
  if (people.isError) {
    const forbidden = people.error instanceof ApiError && people.error.status === 403;
    return (
      <p className="text-footnote text-label-secondary">
        {forbidden ? t("fields.users.notAllowed") : t("fields.users.failed")}
      </p>
    );
  }

  const words = query.trim().toLowerCase();
  const shown = people.data.filter(
    (person) =>
      person.status === "active" &&
      (words === "" || `${person.name} ${person.email}`.toLowerCase().includes(words)),
  );

  return (
    <div className="flex flex-col gap-2">
      {people.data.length > 6 && (
        <SearchField label={t("fields.users.search")} value={query} onValueChange={setQuery} />
      )}
      <ul className="max-h-56 overflow-y-auto rounded-card bg-fill/50">
        {shown.map((person, index) => (
          <li key={person.id} className="[&+&]:hairline-top">
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
              <input
                id={index === 0 ? controlId : undefined}
                type={isSingle ? "radio" : "checkbox"}
                name={isSingle ? controlId : undefined}
                checked={chosen.includes(person.id)}
                onChange={() => toggle(person.id)}
                className="size-4 accent-accent-fill"
              />
              <Avatar name={person.name} imageUrl={person.avatarUrl} size="small" />
              <span className="min-w-0 flex-1 truncate text-body text-label">{person.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
