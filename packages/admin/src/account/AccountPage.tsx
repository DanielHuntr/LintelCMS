import { ShieldAlert } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useSession } from "../session/SessionContext.js";
import { useAccount } from "./account.queries.js";
import { EmailSection } from "./EmailSection.js";
import { PasskeysSection } from "./PasskeysSection.js";
import { PasswordSection } from "./PasswordSection.js";
import { ProfileSection } from "./ProfileSection.js";
import { SessionsSection } from "./SessionsSection.js";
import { TwoFactorSection } from "./TwoFactorSection.js";

/**
 * /account: the signed-in person's own account. Someone whose role requires two-factor
 * authentication is sent here until they turn it on, so the reason comes first.
 */
export function AccountPage() {
  const session = useSession();
  const account = useAccount();

  return (
    <>
      <LargeTitle title={t("account.title")} subtitle={t("account.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-6">
        {session.mustSetUpTwoFactor && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-card bg-warning/14 p-4 text-body text-label"
          >
            <ShieldAlert
              aria-hidden="true"
              strokeWidth={2}
              className="mt-0.5 size-5 shrink-0 text-warning"
            />
            {t("account.twoFactor.requiredNotice")}
          </div>
        )}
        {account.isError && (
          <LoadError error={account.error} onRetry={() => void account.refetch()} />
        )}
        {account.isPending && (
          <LoadingRegion label={t("account.loading")}>
            <Skeleton className="h-48 rounded-card" />
          </LoadingRegion>
        )}
        {session.mustSetUpTwoFactor && <TwoFactorSection />}
        {account.data && (
          <>
            <ProfileSection key={account.data.name} account={account.data} />
            <EmailSection account={account.data} />
            <PasswordSection />
            {!session.mustSetUpTwoFactor && <TwoFactorSection />}
            <PasskeysSection />
            <SessionsSection />
          </>
        )}
      </div>
    </>
  );
}
