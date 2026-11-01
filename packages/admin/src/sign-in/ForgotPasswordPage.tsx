import { Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { EmailField } from "../design/EmailField.js";
import { t } from "../i18n/strings.js";
import { requestPasswordReset } from "../session/session.api.js";
import { PublicScreen } from "./PublicScreen.js";

/**
 * /forgot-password: asks for an email and sends a reset link. The answer is the same
 * whether or not the address has an account, so it can't be used to find out who does.
 */
export function ForgotPasswordPage({
  send = requestPasswordReset,
}: {
  send?: typeof requestPasswordReset;
}) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [answer, setAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSending(true);
    setErrorMessage("");
    try {
      setAnswer((await send(email.trim())).message);
    } catch (error) {
      setErrorMessage(describeFormError(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PublicScreen title={t("forgotPassword.title")} subtitle={t("forgotPassword.subtitle")}>
      {answer ? (
        <div
          role="status"
          className="mt-10 flex items-start gap-3 rounded-card bg-surface p-5 text-body text-label"
        >
          <MailCheck
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-5 shrink-0 text-success"
          />
          <p>{answer}</p>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-10 flex flex-col gap-6">
          <EmailField
            fieldSize="large"
            label={t("signIn.email")}
            value={email}
            onValueChange={setEmail}
            autoComplete="email"
            required
          />
          <Button type="submit" size="extra-large" fullWidth disabled={isSending}>
            {isSending ? t("forgotPassword.sending") : t("forgotPassword.send")}
          </Button>
        </form>
      )}
      <p role="alert" className="mt-5 text-footnote text-danger empty:mt-0">
        {errorMessage}
      </p>
      <Link
        to="/sign-in"
        search={{ redirect: undefined }}
        className="mt-6 inline-block rounded-control text-body text-accent hover:underline focus-visible:focus-ring"
      >
        {t("forgotPassword.backToSignIn")}
      </Link>
    </PublicScreen>
  );
}
