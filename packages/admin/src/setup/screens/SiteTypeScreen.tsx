import { Briefcase, File, Images, NotebookPen, ShoppingBag } from "lucide-react";
import { useId } from "react";
import { ChoiceCardGroup, type ChoiceCard } from "../../design/ChoiceCardGroup.js";
import { t } from "../../i18n/strings.js";
import type { SiteType } from "../setup.api.js";
import { WizardScreen } from "../WizardScreen.js";

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
    icon: File,
  },
];

interface SiteTypeScreenProps {
  siteType: SiteType;
  onSiteTypeChange: (siteType: SiteType) => void;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * "What are you building?" Picking a tile only selects it; Continue moves on. The kind of site
 * decides the features, which can be changed later in Settings.
 */
export function SiteTypeScreen({
  siteType,
  onSiteTypeChange,
  onContinue,
  onBack,
}: SiteTypeScreenProps) {
  const titleId = useId();

  return (
    <WizardScreen
      title={t("site.title")}
      subtitle={t("site.subtitle")}
      width="wide"
      onContinue={onContinue}
      onBack={onBack}
    >
      <span id={titleId} className="sr-only">
        {t("site.title")}
      </span>
      <ChoiceCardGroup
        labelledBy={titleId}
        options={siteChoices}
        value={siteType}
        onChange={onSiteTypeChange}
        columns={3}
      />
      <p className="mt-6 text-center text-footnote text-label-secondary">{t("site.changeLater")}</p>
    </WizardScreen>
  );
}

/** "Online shop" for "shop", as on the tile. */
export function siteTypeTitle(siteType: SiteType): string {
  return siteChoices.find((choice) => choice.value === siteType)?.title ?? siteType;
}
