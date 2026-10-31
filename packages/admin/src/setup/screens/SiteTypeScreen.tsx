import { Briefcase, Images, NotebookPen, ShoppingBag, Sparkles } from "lucide-react";
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
    icon: Sparkles,
  },
];

interface SiteTypeScreenProps {
  siteType: SiteType;
  onSiteTypeChange: (siteType: SiteType) => void;
  /** Picking a tile is the whole question, so a click moves straight on. */
  onChosen: (siteType: SiteType) => void;
  onContinue: () => void;
}

/**
 * "What are you building?" There is no Back: the account already exists, and the
 * features screen that follows can always come back here.
 */
export function SiteTypeScreen({
  siteType,
  onSiteTypeChange,
  onChosen,
  onContinue,
}: SiteTypeScreenProps) {
  const titleId = useId();

  return (
    <WizardScreen
      title={t("site.title")}
      subtitle={t("site.subtitle")}
      width="wide"
      onContinue={onContinue}
    >
      <span id={titleId} className="sr-only">
        {t("site.title")}
      </span>
      <ChoiceCardGroup
        labelledBy={titleId}
        options={siteChoices}
        value={siteType}
        onChange={onSiteTypeChange}
        onActivate={onChosen}
        columns={3}
      />
    </WizardScreen>
  );
}
