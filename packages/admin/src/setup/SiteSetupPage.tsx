import { useNavigate } from "@tanstack/react-router";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";
import { setupApi, type Plugin, type SetupStatus } from "./setup.api.js";
import { rememberedSetupCode } from "./setupCode.js";
import { stepNumberOf } from "./setupRouting.js";
import { SetupShell } from "./SetupShell.js";
import { SiteStep } from "./SiteStep.js";

interface SiteSetupPageProps {
  status: SetupStatus;
  session: Session;
  plugins: readonly Plugin[];
}

/**
 * /setup/site: "What are you building?". It has its own address because the person is signed
 * in by now, and anyone who closes the tab here is brought back to finish it.
 */
export function SiteSetupPage({ status, session, plugins }: SiteSetupPageProps) {
  const navigate = useNavigate();

  return (
    <SetupShell title={t("setup.title")} subtitle={t("setup.subtitle")}>
      <SiteStep
        plugins={plugins}
        api={setupApi}
        setupCode={rememberedSetupCode()}
        stepNumber={stepNumberOf("site", status)}
        onFinished={() => void navigate({ to: "/", state: { welcomeEmail: session.user.email } })}
      />
    </SetupShell>
  );
}
