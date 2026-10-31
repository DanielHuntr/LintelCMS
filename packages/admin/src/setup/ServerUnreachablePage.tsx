import { useRouter } from "@tanstack/react-router";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { SetupShell } from "./SetupShell.js";

/**
 * Shown when the admin can't ask the API whether Lintel is set up, or who is signed in.
 * On a first run that almost always means the API isn't running, so it says how to start it.
 */
export function ServerUnreachablePage() {
  const router = useRouter();

  return (
    <SetupShell title={t("serverUnreachable.title")} subtitle={t("serverUnreachable.body")}>
      <div className="flex justify-center">
        <Button onClick={() => void router.invalidate()}>{t("serverUnreachable.retry")}</Button>
      </div>
    </SetupShell>
  );
}
