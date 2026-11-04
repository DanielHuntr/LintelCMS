import type { LiveAttendee, LivePerson } from "@lintel/builder-model";
import { useEffect, useId, useRef, useState } from "react";
import { initialsOf } from "../design/Avatar.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { personColour } from "./personColour.js";

const MOST_SHOWN = 3;

/** One person's small round picture or initials, in their colour. */
export function PersonDot({
  person,
  className,
}: {
  person: Pick<LivePerson, "id" | "name" | "avatarUrl">;
  className?: string;
}) {
  const shape = "shrink-0 rounded-full ring-2 ring-surface";
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        className={classNames(shape, "bg-fill object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: personColour(person.id) }}
      className={classNames(
        shape,
        "flex items-center justify-center font-semibold text-white",
        className,
      )}
    >
      {initialsOf(person.name)}
    </span>
  );
}

function whereTheyAre(person: LiveAttendee): string {
  return person.view === "design" ? t("collab.where.design") : t("collab.where.content");
}

/**
 * Who else is on this page, for the top bar both of its views share. With nobody else here it
 * takes no room at all; pressing it lists their names and which view they have open.
 */
export function PeopleHere({ people }: { people: readonly LiveAttendee[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  if (people.length === 0) return null;
  const shown = people.slice(0, MOST_SHOWN);
  const more = people.length - shown.length;
  const summary =
    people.length === 1
      ? t("collab.alsoHere.one", { name: people[0]?.name ?? "" })
      : t("collab.alsoHere.many", { count: people.length });

  return (
    <div
      ref={container}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={summary}
        title={summary}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 items-center rounded-control px-1 hover:bg-fill focus-visible:focus-ring"
      >
        {shown.map((person, index) => (
          <PersonDot
            key={person.id}
            person={person}
            className={classNames("size-6 text-[0.625rem]", index > 0 && "-ms-1.5")}
          />
        ))}
        {more > 0 && (
          <span
            aria-hidden="true"
            className="-ms-1.5 flex size-6 items-center justify-center rounded-full bg-fill-strong text-[0.625rem] font-semibold text-label ring-2 ring-surface"
          >
            +{more}
          </span>
        )}
      </button>
      {isOpen && (
        <ul
          id={listId}
          aria-label={t("collab.alsoHere.heading")}
          className="absolute end-0 top-full z-50 mt-1 w-60 rounded-card bg-surface-raised p-1.5 shadow-float"
        >
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-2.5 px-2 py-1.5">
              <PersonDot person={person} className="size-7 text-[0.6875rem] ring-0" />
              <span className="min-w-0">
                <span className="block truncate text-footnote font-medium text-label">
                  {person.name}
                </span>
                <span className="block truncate text-caption text-label-secondary">
                  {whereTheyAre(person)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Who is on a page, small, at the end of its row in the tree. */
export function PeopleOnRow({ people }: { people: readonly LivePerson[] }) {
  if (people.length === 0) return null;
  const names = people.map((person) => person.name).join(", ");
  return (
    <span
      title={t("collab.onThisPage", { names })}
      data-people-on-row
      className="flex shrink-0 items-center"
    >
      <span className="sr-only">{t("collab.onThisPage", { names })}</span>
      {people.slice(0, 2).map((person, index) => (
        <PersonDot
          key={person.id}
          person={person}
          className={classNames("size-4 text-[0.5rem] ring-1", index > 0 && "-ms-1")}
        />
      ))}
    </span>
  );
}
