import { useNavigate } from "@tanstack/react-router";
import type { Session } from "../session/session.api.js";
import { setupApi, type Plugin, type SetupStatus } from "./setup.api.js";
import { rememberedSetupCode } from "./setupCode.js";
import { SiteWizard } from "./SiteWizard.js";

interface SiteSetupPageProps {
  status: SetupStatus;
  session: Session;
  plugins: readonly Plugin[];
}

/**
 * /setup/site: "What are you building?" onwards. It has its own address because the person
 * is signed in by now, and anyone who closes the tab here is brought back to finish it.
 */
export function SiteSetupPage({ status, session, plugins }: SiteSetupPageProps) {
  const navigate = useNavigate();

  return (
    <SiteWizard
      status={status}
      session={session}
      plugins={plugins}
      api={setupApi}
      setupCode={rememberedSetupCode()}
      onGoToDashboard={() => void navigate({ to: "/" })}
      onStartFromTemplate={() => void navigate({ to: "/design" })}
    />
  );
}
