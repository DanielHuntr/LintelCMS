import { Link, useLocation, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useBranding } from "../branding/brandingStore.js";
import { DisplayTitle } from "../design/DisplayTitle.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { passkeySignInOptions, signInWithPasskeyResponse } from "../account/account.api.js";
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
          <SignInForm
            signIn={signIn}
            onSignedIn={handleSignedIn}
            signInWithPasskey={browserSupportsWebAuthn() ? signInWithPasskey : undefined}
          />
          <Link
            to="/forgot-password"
            className="mt-2 inline-block rounded-control text-body text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
          >
            {t("signIn.forgotPassword")}
          </Link>
        </div>
      </div>
    </FullScreenLayout>
  );
}

async function signInWithPasskey() {
  const optionsJSON = await passkeySignInOptions();
  return signInWithPasskeyResponse(await startAuthentication({ optionsJSON }));
}

/**
 * Only follow redirects within the admin, so a link can't send people to another site.
 * Browsers read a backslash as a slash and drop tabs and line breaks, so "/\\evil.example"
 * and "/\t/evil.example" would both leave the admin: the address must parse as one of ours.
 */
export function safeRedirect(redirect: string | undefined): string {
  if (!redirect?.startsWith("/") || /[\\\s]/.test(redirect) || redirect.startsWith("//")) {
    return "/";
  }
  const base = "https://admin.invalid";
  const resolved = new URL(redirect, base);
  return resolved.origin === base ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/";
}
