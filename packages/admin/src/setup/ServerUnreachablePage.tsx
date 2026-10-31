import { useRouter } from "@tanstack/react-router";
import { ServerOff } from "lucide-react";
import { t } from "../i18n/strings.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";
import { WizardScreen } from "./WizardScreen.js";

/**
 * Shown when the admin can't ask the API whether Lintel is set up, or who is signed in.
 * On a first run that almost always means the API isn't running, so it says how to start it.
 */
export function ServerUnreachablePage() {
  const router = useRouter();

  return (
    <FullScreenLayout showsAppMark={false}>
      <WizardScreen
        layout="hero"
        heroMark={
          <span className="flex size-20 items-center justify-center rounded-full bg-fill text-label-secondary">
            <ServerOff aria-hidden="true" strokeWidth={1.75} className="size-9" />
          </span>
        }
        title={t("serverUnreachable.title")}
        subtitle={t("serverUnreachable.body")}
        continueLabel={t("serverUnreachable.retry")}
        onContinue={() => void router.invalidate()}
      />
    </FullScreenLayout>
  );
}
