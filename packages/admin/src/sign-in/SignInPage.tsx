import { useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useBranding } from "../branding/brandingStore.js";
import { DisplayTitle } from "../design/DisplayTitle.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { loadInterfaceLanguage } from "../interface-language/loadInterfaceLanguage.js";
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

  const { signInMessage, signInBackground } = useBranding();

  async function handleSignedIn() {
    // Speak the language this person chose, then re-run the session check for the new cookie.
    await loadInterfaceLanguage();
    await router.invalidate();
    await navigate({ to: safeRedirect(redirect) });
  }

  return (
    <FullScreenLayout backgroundImage={signInBackground}>
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-24">
        <div
          className={classNames(
            "w-full max-w-[420px]",
            // On a picture, the form sits on a card so it stays readable.
            signInBackground && "rounded-panel bg-surface p-8 shadow-float hairline-ring",
          )}
        >
          <DisplayTitle>{t("signIn.title")}</DisplayTitle>
          <p className="mt-3 text-headline font-normal text-label-secondary">
            {setupAlreadyDone ? t("signIn.alreadySetUp") : t("signIn.subtitle")}
          </p>
          {signInMessage && (
            <p className="mt-4 rounded-card bg-fill/60 px-4 py-3 text-body whitespace-pre-line text-label">
              {signInMessage}
            </p>
          )}
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
