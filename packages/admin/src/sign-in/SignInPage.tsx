import { useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { AppMark } from "../design/AppMark.js";
import { t } from "../i18n/strings.js";
import { signIn } from "../session/session.api.js";
import { SignInForm } from "./SignInForm.js";

/**
 * The sign-in screen. After signing in, people go back to the page they were trying
 * to reach (the `redirect` search parameter), or to the dashboard.
 */
export function SignInPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = useSearch({ from: "/setup-gate/sign-in" });
  // Set when someone arrived from setup, only to find Lintel was already set up.
  const setupAlreadyDone = useLocation({ select: (location) => location.state.setupAlreadyDone });

  async function handleSignedIn() {
    // Re-run the admin's session check so it picks up the new cookie.
    await router.invalidate();
    await navigate({ to: safeRedirect(redirect) });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-label">
      <div className="flex w-full max-w-[380px] flex-col items-center">
        <AppMark size="large" />
        <h1 className="mt-6 text-title text-label">{t("signIn.title")}</h1>
        <p className="mt-1.5 text-center text-body text-label-secondary">
          {setupAlreadyDone ? t("signIn.alreadySetUp") : t("signIn.subtitle")}
        </p>
        <SignInForm signIn={signIn} onSignedIn={handleSignedIn} />
      </div>
    </main>
  );
}

/** Only follow redirects within the admin, so a link can't send people to another site. */
export function safeRedirect(redirect: string | undefined): string {
  return redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
}
