import { useState } from "react";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";
import { DoneScreen } from "./screens/DoneScreen.js";
import { FeaturesScreen } from "./screens/FeaturesScreen.js";
import { SiteTypeScreen } from "./screens/SiteTypeScreen.js";
import type { Plugin, SetupApi, SetupCode, SetupStatus, SiteType } from "./setup.api.js";
import { explainSetupFailure } from "./setupErrors.js";
import { setupProgress, type SiteScreen } from "./setupRouting.js";
import { pluginsForSiteType } from "./sitePresets.js";
import { afterSelectionShows, useWizardScreens } from "./useWizardScreens.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";

interface SiteWizardProps {
  status: SetupStatus;
  session: Session;
  /** Every plugin there is, from `GET /plugins`. */
  plugins: readonly Plugin[];
  api: Pick<SetupApi, "saveSiteSetup">;
  setupCode: SetupCode;
  onGoToDashboard: () => void;
  /** The finish screen's other way in: the template library. */
  onStartFromTemplate?: () => void;
}

/**
 * The screens at /setup/site, once the account exists: what the site is for, which features
 * to switch on, and the "You're all set" finish.
 */
export function SiteWizard({
  status,
  session,
  plugins,
  api,
  setupCode,
  onGoToDashboard,
  onStartFromTemplate,
}: SiteWizardProps) {
  const { screen, goTo } = useWizardScreens<SiteScreen>("site-type");
  const [siteType, setSiteType] = useState<SiteType>("business");
  const [enabledPlugins, setEnabledPlugins] = useState(() => pluginsForSiteType("business"));
  const [savedPlugins, setSavedPlugins] = useState<string[]>([]);
  const [savingAs, setSavingAs] = useState<"finish" | "skip">();
  const [statusMessage, setStatusMessage] = useState("");

  function chooseSiteType(value: SiteType) {
    setSiteType(value);
    // A new choice starts again from its own preset rather than mixing in earlier toggles.
    setEnabledPlugins(pluginsForSiteType(value));
  }

  function togglePlugin(pluginId: string, isOn: boolean) {
    setEnabledPlugins(
      isOn ? [...enabledPlugins, pluginId] : enabledPlugins.filter((id) => id !== pluginId),
    );
  }

  async function save(chosenType: SiteType, chosenPlugins: string[], action: "finish" | "skip") {
    setSavingAs(action);
    setStatusMessage("");
    try {
      await api.saveSiteSetup(chosenType, chosenPlugins, setupCode);
    } catch (error) {
      const failure = explainSetupFailure(error);
      // "Already done" means another tab finished first: nothing is lost by finishing here.
      if (failure.kind !== "already-set-up") {
        setSavingAs(undefined);
        setStatusMessage(failure.kind === "unreachable" ? t("setup.unreachable") : failure.message);
        return;
      }
    }
    setSavingAs(undefined);
    setSavedPlugins(chosenPlugins);
    goTo("done");
  }

  function finish() {
    // Sent in the API's own plugin order, whatever order the toggles were flipped in.
    const chosen = plugins.map(({ id }) => id).filter((id) => enabledPlugins.includes(id));
    void save(siteType, chosen, "finish");
  }

  return (
    <FullScreenLayout
      progress={setupProgress(screen, status, status.database.kind)}
      showsAppMark={screen !== "done"}
    >
      {renderScreen()}
    </FullScreenLayout>
  );

  function renderScreen() {
    switch (screen) {
      case "site-type":
        return (
          <SiteTypeScreen
            siteType={siteType}
            onSiteTypeChange={chooseSiteType}
            onChosen={() => afterSelectionShows(() => goTo("features"))}
            onContinue={() => goTo("features")}
          />
        );
      case "features":
        return (
          <FeaturesScreen
            plugins={plugins}
            enabledPlugins={enabledPlugins}
            onToggle={togglePlugin}
            onContinue={finish}
            onSkip={() => void save("blank", [], "skip")}
            onBack={() => goTo("site-type", "back")}
            savingAs={savingAs}
            statusMessage={statusMessage}
          />
        );
      default:
        return (
          <DoneScreen
            name={firstNameOf(session.user.name)}
            summary={summaryOf(status, plugins, savedPlugins)}
            onContinue={onGoToDashboard}
            onStartFromTemplate={onStartFromTemplate}
          />
        );
    }
  }
}

/** "Daniel Roberts" is greeted as "Daniel". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Built-in database · Blog, SEO tools", using the API's own plugin names. */
export function summaryOf(
  status: SetupStatus,
  plugins: readonly Plugin[],
  savedPlugins: readonly string[],
): string {
  const database = status.database.kind === "postgres" ? t("done.postgres") : t("done.builtIn");
  const features = plugins
    .filter(({ id }) => savedPlugins.includes(id))
    .map(({ name }) => name)
    .join(", ");
  return t("done.summary", { database, features: features || t("done.noFeatures") });
}
