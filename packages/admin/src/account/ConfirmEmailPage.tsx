import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { describeFormError } from "../api/describeError.js";
import { t } from "../i18n/strings.js";
import { PublicScreen } from "../sign-in/PublicScreen.js";
import { tokenFromAddress } from "../sign-in/tokenFromAddress.js";
import { confirmEmailChange } from "./account.api.js";

/** /confirm-email#token=...: opened from the new address's inbox; confirms straight away. */
export function ConfirmEmailPage() {
  const [token] = useState(() => tokenFromAddress());
  const [outcome, setOutcome] = useState<"checking" | "done" | string>(
    token ? "checking" : t("confirmEmail.invalid"),
  );

  useEffect(() => {
    if (!token) return;
    confirmEmailChange(token).then(
      () => setOutcome("done"),
      (error: unknown) => setOutcome(describeFormError(error)),
    );
  }, [token]);

  const title =
    outcome === "done"
      ? t("confirmEmail.doneTitle")
      : outcome === "checking"
        ? t("confirmEmail.checking")
        : t("confirmEmail.failedTitle");
  return (
    <PublicScreen
      title={title}
      subtitle={
        outcome === "done"
          ? t("confirmEmail.doneSubtitle")
          : outcome === "checking"
            ? undefined
            : outcome
      }
    >
      <Link
        to="/account"
        className="mt-10 inline-block rounded-control text-body font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
      >
        {t("confirmEmail.toAccount")}
      </Link>
    </PublicScreen>
  );
}
