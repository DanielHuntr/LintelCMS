import { useState, type FormEvent } from "react";
import { t } from "../i18n/strings.js";

/**
 * The sign-in screen. The form is real and accessible; sending it to the API
 * is wired up in the next pull request, together with sessions in @lintel/core.
 */
export function SignInPage() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(t("signIn.notReady"));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-8"
      >
        <h1 className="text-xl font-semibold">{t("signIn.title")}</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            {t("signIn.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            {t("signIn.password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-stone-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:opacity-90"
        >
          {t("signIn.submit")}
        </button>

        {message && (
          <p role="status" className="text-sm text-stone-600">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
