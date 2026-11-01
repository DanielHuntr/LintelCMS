import { ChevronRight, ShieldCheck } from "lucide-react";
import { formatRelativeTime } from "../content/relativeTime.js";
import { Avatar } from "../design/Avatar.js";
import { Badge } from "../design/Badge.js";
import { t } from "../i18n/strings.js";
import type { Person } from "./people.api.js";

interface PersonRowProps {
  person: Person;
  isYou: boolean;
  now: number;
  onSelect: () => void;
}

/** One person on the Users screen: who they are, their role, and when they were last here. */
export function PersonRow({ person, isYou, now, onSelect }: PersonRowProps) {
  const lastActive = person.lastActiveAt
    ? t("people.lastActive", { when: formatRelativeTime(person.lastActiveAt, now) })
    : t("people.neverSignedIn");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 pl-4 text-left transition-colors duration-150 ease-standard hover:bg-fill/60 focus-visible:focus-ring-inset active:bg-fill"
      >
        <Avatar name={person.name} imageUrl={person.avatarUrl} />
        <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li+li>*>&]:hairline-top">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="truncate text-body text-label">
                {isYou ? t("people.you", { name: person.name }) : person.name}
              </span>
              {person.twoFactorEnabled && (
                <ShieldCheck
                  aria-label={t("people.twoFactorOn")}
                  role="img"
                  strokeWidth={2}
                  className="size-4 shrink-0 text-success"
                />
              )}
            </span>
            <span className="truncate text-footnote text-label-secondary">
              {person.email} · {lastActive}
            </span>
          </span>
          <span className="flex flex-wrap justify-end gap-1.5">
            {person.status === "deactivated" && (
              <Badge tone="danger">{t("people.status.deactivated")}</Badge>
            )}
            {person.roles.map((role) => (
              <Badge key={role.id} tone={role.handle === "owner" ? "accent" : "neutral"}>
                {role.name}
              </Badge>
            ))}
          </span>
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="-mr-1 size-4 shrink-0 text-label-tertiary"
          />
        </span>
      </button>
    </li>
  );
}
