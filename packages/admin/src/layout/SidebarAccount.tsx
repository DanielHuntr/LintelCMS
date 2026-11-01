import { Link } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { Avatar } from "../design/Avatar.js";
import { t } from "../i18n/strings.js";

export interface SignedInUser {
  name: string;
  email: string;
}

interface SidebarAccountProps {
  signedInUser: SignedInUser | undefined;
  onSignOut?: () => void;
}

/** The bottom of the sidebar: who is signed in (with a sign-out button), or a way to sign in. */
export function SidebarAccount({ signedInUser, onSignOut }: SidebarAccountProps) {
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
    <div className="flex items-center gap-1 px-1 py-1">
      <Link
        to="/account"
        aria-label={t("account.openAccount", { name: signedInUser.name })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-1.5 py-1 transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
      >
        <Avatar name={signedInUser.name} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-label">{signedInUser.name}</span>
          <span className="truncate text-footnote text-label-secondary">{signedInUser.email}</span>
        </span>
      </Link>
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          aria-label={t("account.signOut")}
          title={t("account.signOut")}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring"
        >
          <LogOut aria-hidden="true" strokeWidth={1.75} className="size-[18px]" />
        </button>
      )}
    </div>
  );
}
