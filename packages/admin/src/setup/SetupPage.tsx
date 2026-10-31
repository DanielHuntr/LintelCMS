import { useNavigate } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import { setupApi, type SetupStatus } from "./setup.api.js";
import { SetupFlow } from "./SetupFlow.js";
import { SetupShell } from "./SetupShell.js";

/** /setup: the welcome screen a brand new Lintel opens on. */
export function SetupPage({ status }: { status: SetupStatus }) {
  const navigate = useNavigate();

  return (
    <SetupShell title={t("setup.title")} subtitle={t("setup.subtitle")}>
      <SetupFlow
        status={status}
        api={setupApi}
        // The API has signed the new person in, and every navigation re-checks the session,
        // so going straight on to the last step is all it takes to pick up the new cookie.
        onAccountCreated={() => void navigate({ to: "/setup/site" })}
        onAlreadySetUp={() =>
          void navigate({
            to: "/sign-in",
            search: { redirect: undefined },
            state: { setupAlreadyDone: true },
          })
        }
      />
    </SetupShell>
  );
}
