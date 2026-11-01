import { findHelpPage } from "@lintel/docs/help";
import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { useBranding } from "../branding/brandingStore.js";
import { BackLink } from "../design/BackLink.js";
import { buttonClasses } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { fullDocsUrl } from "./docsLinks.js";
import { HelpArticle } from "./HelpArticle.js";
import { HelpTopicList } from "./HelpTopicList.js";
import { Page } from "../design/Page.js";
import { SupportCard } from "./SupportCard.js";

interface HelpPageProps {
  /** The open topic, kept in the address (`/help?topic=using/media`) so it can be shared. */
  topic: string | undefined;
  /** Opens a topic, or the list when undefined. `anchor` is a heading on that page. */
  onOpenTopic: (topic: string | undefined, anchor?: string) => void;
  anchor?: string;
}

/**
 * The Help section: who to ask (from Settings → Branding), then every "Using Lintel" page,
 * readable without leaving the admin. An agency can hide Lintel's own pages and links,
 * leaving only its support details and guides.
 */
export function HelpPage({ topic, onOpenTopic, anchor }: HelpPageProps) {
  const { hideLintelHelp } = useBranding();
  const page = topic && !hideLintelHelp ? findHelpPage(topic) : undefined;
  const fullDocsLink = hideLintelHelp ? undefined : (
    <a
      href={fullDocsUrl(page?.slug ?? "using")}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses("tinted", "medium")}
    >
      {t("help.fullDocs")}
      <ArrowUpRight aria-hidden="true" strokeWidth={2} className="size-4" />
      <span className="sr-only">{t("help.newTab")}</span>
    </a>
  );

  // Moving between topics keeps the same screen, so start each one at the top.
  useEffect(() => {
    if (!anchor) window.scrollTo({ top: 0 });
  }, [topic, anchor]);

  if (!page) {
    return (
      <Page width="readable">
        <LargeTitle
          title={t("help.pageTitle")}
          subtitle={hideLintelHelp ? t("help.support.pageSubtitle") : t("help.pageSubtitle")}
          actions={fullDocsLink}
        />
        <SupportCard />
        {hideLintelHelp ? (
          <NoBuiltInHelp />
        ) : (
          <HelpTopicList onOpenPage={(slug) => onOpenTopic(slug)} />
        )}
      </Page>
    );
  }

  return (
    <Page width="readable">
      <BackLink to="/help" search={{}}>
        {t("help.pageTitle")}
      </BackLink>
      <LargeTitle title={page.title} subtitle={page.description} actions={fullDocsLink} />
      <Card>
        <HelpArticle page={page} anchor={anchor} onOpenPage={onOpenTopic} titleLevel={1} />
      </Card>
    </Page>
  );
}

/** With Lintel's pages hidden and no support details set, say where help would appear. */
function NoBuiltInHelp() {
  const { supportUrl, supportEmail, docsUrl } = useBranding();
  if (supportUrl || supportEmail || docsUrl) return null;
  return <p className="text-body text-label-secondary">{t("help.support.none")}</p>;
}
