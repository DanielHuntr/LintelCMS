import { Fingerprint } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { Button } from "../design/Button.js";
import { EmailField } from "../design/EmailField.js";
import { PasswordField } from "../design/PasswordField.js";
import { t } from "../i18n/strings.js";
import {
  completeTwoFactorSignIn,
  isTwoFactorChallenge,
  type Session,
  type TwoFactorChallenge,
} from "../session/session.api.js";
import { TwoFactorStep } from "./TwoFactorStep.js";

interface SignInFormProps {
  /** Sends the details to the API. Passed in so tests can use a fake. */
  signIn: (email: string, password: string) => Promise<Session | TwoFactorChallenge>;
  onSignedIn: (session: Session) => void;
  /** The second step for people with two-factor on. */
  completeTwoFactor?: typeof completeTwoFactorSignIn;
  /** Signs in with a passkey; left out where the browser can't use them. */
  signInWithPasskey?: () => Promise<Session>;
}

/**
 * The email and password form. It shows the API's own message when sign-in fails
 * ("That email and password don't match", "Too many sign-in attempts..."), because
 * those messages are written for people. The email field offers a fix for domain typos,
 * a common reason for "doesn't match" when the account was created with the right address.
 *
 * With two-factor authentication on, a correct password leads to a second step asking for
 * the code from the app (see TwoFactorStep).
 */
export function SignInForm({
  signIn,
  onSignedIn,
  completeTwoFactor = completeTwoFactorSignIn,
  signInWithPasskey,
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSigningIn(true);
    setErrorMessage("");

    try {
      const result = await signIn(email.trim(), password);
      if (isTwoFactorChallenge(result)) {
        setChallenge(result);
        setIsSigningIn(false);
        return;
      }
      onSignedIn(result);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t("signIn.unreachable"));
      setIsSigningIn(false);
    }
  }

  async function handlePasskey() {
    if (!signInWithPasskey) return;
    setErrorMessage("");
    try {
      onSignedIn(await signInWithPasskey());
    } catch (error) {
      // Closing the browser's passkey prompt is a choice, not a failure worth a message.
      if (error instanceof Error && error.name === "NotAllowedError") return;
      setErrorMessage(error instanceof ApiError ? error.message : t("signIn.passkeyFailed"));
    }
  }

  if (challenge) {
    return (
      <TwoFactorStep
        completeSignIn={(answer) => completeTwoFactor(challenge.challengeToken, answer)}
        onSignedIn={onSignedIn}
        onStartAgain={() => {
          setChallenge(null);
          setPassword("");
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex w-full flex-col gap-6">
      <EmailField
        fieldSize="large"
        label={t("signIn.email")}
        name="email"
        value={email}
        onValueChange={setEmail}
        autoComplete="username webauthn"
        required
      />
      <PasswordField
        fieldSize="large"
        label={t("signIn.password")}
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
      />
      {/*
        By the fields, above Sign in, where people look (LINTEL-A11Y-037). Always rendered,
        so screen readers are already listening when a message arrives; empty, it takes no room.
      */}
      <p role="status" className="text-footnote text-danger empty:-mt-6">
        {errorMessage}
      </p>
      <Button type="submit" size="extra-large" fullWidth className="mt-2" disabled={isSigningIn}>
        {isSigningIn ? t("signIn.submitting") : t("signIn.submit")}
      </Button>
      {signInWithPasskey && (
        <Button
          type="button"
          variant="tinted"
          size="extra-large"
          fullWidth
          icon={<Fingerprint aria-hidden="true" strokeWidth={2} />}
          onClick={() => void handlePasskey()}
        >
          {t("signIn.withPasskey")}
        </Button>
      )}
    </form>
  );
}
