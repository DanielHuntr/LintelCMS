import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { t } from "../i18n/strings.js";

export interface SignedInUser {
  name: string;
  email: string;
}

/** The bottom of the sidebar: who is signed in, or a way to sign in. */
export function SidebarAccount({ signedInUser }: { signedInUser: SignedInUser | undefined }) {
  if (!signedInUser) {
    return (
      <Link
        to="/sign-in"
        className="flex items-center gap-3 rounded-control px-2.5 py-2 transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-secondary">
          <UserRound aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-body font-medium text-label">{t("account.signIn")}</span>
          <span className="truncate text-footnote text-label-secondary">
            {t("account.signInHint")}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 px-2.5 py-2">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-fill text-footnote font-semibold text-on-accent"
      >
        {initialsOf(signedInUser.name)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-label">{signedInUser.name}</span>
        <span className="truncate text-footnote text-label-secondary">{signedInUser.email}</span>
      </span>
    </div>
  );
}

/** "Ada Lovelace" becomes "AL"; a single name gives one letter. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}
