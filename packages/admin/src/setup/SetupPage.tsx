import { useNavigate } from "@tanstack/react-router";
import { setupApi, type SetupStatus } from "./setup.api.js";
import { SetupWizard } from "./SetupWizard.js";

/** /setup: the welcome screen a brand new Lintel opens on, through to "You're all set". */
export function SetupPage({ status }: { status: SetupStatus }) {
  const navigate = useNavigate();

  return (
    <SetupWizard
      status={status}
      api={setupApi}
      // The API has signed the owner in, and every navigation re-checks the session, so
      // going to the dashboard is all it takes to pick up the new cookie.
      onFinished={() => void navigate({ to: "/", viewTransition: true })}
      onAlreadySetUp={() =>
        void navigate({
          to: "/sign-in",
          search: { redirect: undefined },
          state: { setupAlreadyDone: true },
        })
      }
    />
  );
}
