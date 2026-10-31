import { useState, type FormEvent } from "react";
import { AppMark } from "../design/AppMark.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";

/**
 * The sign-in screen. The form is real and accessible; sending it to the API
 * is wired up in the next pull request, together with sessions in @lintel/core.
 */
export function SignInPage() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(t("signIn.notReady"));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-label">
      <div className="flex w-full max-w-[380px] flex-col items-center">
        <AppMark size="large" />
        <h1 className="mt-6 text-title text-label">{t("signIn.title")}</h1>
        <p className="mt-1.5 text-center text-body text-label-secondary">{t("signIn.subtitle")}</p>

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
          <Button type="submit" size="large" fullWidth className="mt-1">
            {t("signIn.submit")}
          </Button>
        </form>

        {/* Always rendered, so screen readers are already listening when the message arrives. */}
        <p role="status" className="mt-5 min-h-5 text-center text-footnote text-label-secondary">
          {message}
        </p>
      </div>
    </main>
  );
}
