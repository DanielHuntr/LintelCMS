import { Briefcase, Images, NotebookPen, ShoppingBag, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../design/Button.js";
import { ChoiceCardGroup, type ChoiceCard } from "../design/ChoiceCardGroup.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { Plugin, SetupApi, SetupCode, SiteType } from "./setup.api.js";
import { explainSetupFailure } from "./setupErrors.js";
import { pluginsForSiteType } from "./sitePresets.js";
import { StatusLine, StepPanel } from "./StepPanel.js";

const siteChoices: readonly ChoiceCard<SiteType>[] = [
  {
    value: "business",
    title: t("site.business"),
    description: t("site.businessDescription"),
    icon: Briefcase,
  },
  {
    value: "blog",
    title: t("site.blog"),
    description: t("site.blogDescription"),
    icon: NotebookPen,
  },
  {
    value: "shop",
    title: t("site.shop"),
    description: t("site.shopDescription"),
    icon: ShoppingBag,
  },
  {
    value: "portfolio",
    title: t("site.portfolio"),
    description: t("site.portfolioDescription"),
    icon: Images,
  },
  {
    value: "blank",
    title: t("site.blank"),
    description: t("site.blankDescription"),
    icon: Sparkles,
  },
];

interface SiteStepProps {
  /** Every plugin there is, from `GET /plugins`. */
  plugins: readonly Plugin[];
  api: Pick<SetupApi, "saveSiteSetup">;
  setupCode: SetupCode;
  stepNumber?: { current: number; total: number };
  onFinished: () => void;
}

/**
 * "What are you building?" Each kind of site switches on the plugins it needs, and the
 * toggles underneath show exactly which, so the choice is never a mystery.
 */
export function SiteStep({ plugins, api, setupCode, stepNumber, onFinished }: SiteStepProps) {
  const [siteType, setSiteType] = useState<SiteType>("business");
  const [enabledPlugins, setEnabledPlugins] = useState(() => pluginsForSiteType("business"));
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
      onFinished();
    } catch (error) {
      setSavingAs(undefined);
      const failure = explainSetupFailure(error);
      if (failure.kind === "already-set-up") {
        onFinished();
      } else {
        setStatusMessage(failure.kind === "unreachable" ? t("setup.unreachable") : failure.message);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Sent in the API's own plugin order, whatever order the toggles were flipped in.
    const chosenPlugins = plugins.map(({ id }) => id).filter((id) => enabledPlugins.includes(id));
    void save(siteType, chosenPlugins, "finish");
  }

  return (
    <StepPanel title={t("site.title")} stepNumber={stepNumber} takesFocus>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col">
        <ChoiceCardGroup
          label={t("site.title")}
          options={siteChoices}
          value={siteType}
          onChange={chooseSiteType}
        />

        <FeatureToggles plugins={plugins} enabledPlugins={enabledPlugins} onToggle={togglePlugin} />

        <Button
          type="submit"
          size="large"
          fullWidth
          className="mt-7"
          disabled={savingAs !== undefined}
        >
          {savingAs === "finish" ? t("site.finishing") : t("site.finish")}
        </Button>
        <Button
          variant="plain"
          fullWidth
          className="mt-3"
          disabled={savingAs !== undefined}
          onClick={() => void save("blank", [], "skip")}
        >
          {t("site.skip")}
        </Button>
      </form>
      <StatusLine message={statusMessage} />
    </StepPanel>
  );
}

interface FeatureTogglesProps {
  plugins: readonly Plugin[];
  enabledPlugins: readonly string[];
  onToggle: (pluginId: string, isOn: boolean) => void;
}

/** One switch per plugin, with its name and what it adds, under a quiet "Features" heading. */
function FeatureToggles({ plugins, enabledPlugins, onToggle }: FeatureTogglesProps) {
  return (
    <div className="mt-8">
      <h3 className="text-footnote font-medium text-label-secondary">{t("site.features")}</h3>
      <ul className="mt-2">
        {plugins.map((plugin) => (
          <li key={plugin.id} className="flex items-center gap-4 py-3 [&+&]:hairline-top">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-label">{plugin.name}</span>
              <span className="text-footnote text-label-secondary">{plugin.description}</span>
            </div>
            <Toggle
              label={plugin.name}
              labelVisibility="hidden"
              checked={enabledPlugins.includes(plugin.id)}
              onCheckedChange={(isOn) => onToggle(plugin.id, isOn)}
            />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-footnote text-label-secondary">{t("site.featuresNote")}</p>
    </div>
  );
}
