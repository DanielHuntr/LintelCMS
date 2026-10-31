import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { Button } from "../design/Button.js";
import { EmailField } from "../design/EmailField.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";

interface SignInFormProps {
  /** Sends the details to the API. Passed in so tests can use a fake. */
  signIn: (email: string, password: string) => Promise<Session>;
  onSignedIn: (session: Session) => void;
}

/**
 * The email and password form. It shows the API's own message when sign-in fails
 * ("That email and password don't match", "Too many sign-in attempts..."), because
 * those messages are written for people. The email field offers a fix for domain typos,
 * a common reason for "doesn't match" when the account was created with the right address.
 */
export function SignInForm({ signIn, onSignedIn }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSigningIn(true);
    setErrorMessage("");

    try {
      const session = await signIn(email.trim(), password);
      onSignedIn(session);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t("signIn.unreachable"));
      setIsSigningIn(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="mt-8 flex w-full flex-col gap-5 rounded-panel bg-surface p-7 shadow-float"
      >
        <EmailField
          label={t("signIn.email")}
          name="email"
          value={email}
          onValueChange={setEmail}
          autoComplete="email"
          required
        />
        <PasswordField
          label={t("signIn.password")}
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="large" fullWidth className="mt-1" disabled={isSigningIn}>
          {isSigningIn ? t("signIn.submitting") : t("signIn.submit")}
        </Button>
      </form>

      {/* Always rendered, so screen readers are already listening when a message arrives. */}
      <p role="status" className="mt-5 min-h-5 text-center text-footnote text-danger">
        {errorMessage}
      </p>
    </>
  );
}
