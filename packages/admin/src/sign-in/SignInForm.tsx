import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
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
 * those messages are written for people.
 */
export function SignInForm({ signIn, onSignedIn }: SignInFormProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setIsSigningIn(true);
    setErrorMessage("");

    try {
      const session = await signIn(String(form.get("email")), String(form.get("password")));
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
        <TextField
          label={t("signIn.email")}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <TextField
          label={t("signIn.password")}
          name="password"
          type="password"
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
