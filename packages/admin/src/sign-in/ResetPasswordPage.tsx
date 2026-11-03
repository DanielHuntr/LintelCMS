import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { NewPasswordField } from "../account/NewPasswordField.js";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { passwordIsLongEnough } from "../setup/accountDetails.js";
import { checkResetLink, resetPassword } from "../session/session.api.js";
import { PublicScreen } from "./PublicScreen.js";
import { tokenFromAddress } from "./tokenFromAddress.js";

type LinkState = "checking" | "usable" | "unusable" | "done";

/** /reset-password#token=...: choose a new password from an emailed link. */
export function ResetPasswordPage() {
  const [token] = useState(() => tokenFromAddress());
  const [linkState, setLinkState] = useState<LinkState>(token ? "checking" : "unusable");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    checkResetLink(token).then(
      ({ usable }) => setLinkState(usable ? "usable" : "unusable"),
      () => setLinkState("unusable"),
    );
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setIsSaving(true);
    setErrorMessage("");
    try {
      await resetPassword(token, password);
      setLinkState("done");
    } catch (error) {
      setErrorMessage(describeFormError(error));
    } finally {
      setIsSaving(false);
    }
  }

  const signInLink = (
    <Link
      to="/sign-in"
      search={{ redirect: undefined }}
      className="mt-6 inline-block rounded-control text-body text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
    >
      {linkState === "done" ? t("resetPassword.signIn") : t("forgotPassword.backToSignIn")}
    </Link>
  );

  if (linkState === "unusable" || linkState === "done") {
    return (
      <PublicScreen
        title={
          linkState === "done" ? t("resetPassword.doneTitle") : t("resetPassword.expiredTitle")
        }
        subtitle={
          linkState === "done"
            ? t("resetPassword.doneSubtitle")
            : t("resetPassword.expiredSubtitle")
        }
      >
        {linkState === "unusable" && (
          <Link
            to="/forgot-password"
            className="mt-10 inline-block rounded-control text-body font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
          >
            {t("resetPassword.askAgain")}
          </Link>
        )}
        <div>{signInLink}</div>
      </PublicScreen>
    );
  }

  return (
    <PublicScreen title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")}>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-10 flex flex-col gap-6"
        aria-busy={linkState === "checking"}
      >
        <NewPasswordField
          fieldSize="large"
          label={t("resetPassword.newPassword")}
          value={password}
          onValueChange={setPassword}
          required
        />
        <Button
          type="submit"
          size="extra-large"
          fullWidth
          disabled={isSaving || linkState === "checking" || !passwordIsLongEnough(password)}
        >
          {isSaving ? t("resetPassword.saving") : t("resetPassword.save")}
        </Button>
      </form>
      <p role="alert" className="mt-5 text-footnote text-danger empty:mt-0">
        {errorMessage}
      </p>
      {signInLink}
    </PublicScreen>
  );
}
