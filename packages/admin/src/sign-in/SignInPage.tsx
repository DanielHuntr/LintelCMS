import { useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { DisplayTitle } from "../design/DisplayTitle.js";
import { t } from "../i18n/strings.js";
import { signIn } from "../session/session.api.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";
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
    <FullScreenLayout>
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-[420px]">
          <DisplayTitle>{t("signIn.title")}</DisplayTitle>
          <p className="mt-3 text-headline font-normal text-label-secondary">
            {setupAlreadyDone ? t("signIn.alreadySetUp") : t("signIn.subtitle")}
          </p>
          <SignInForm signIn={signIn} onSignedIn={handleSignedIn} />
        </div>
      </div>
    </FullScreenLayout>
  );
}

/** Only follow redirects within the admin, so a link can't send people to another site. */
export function safeRedirect(redirect: string | undefined): string {
  return redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
}
