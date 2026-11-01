import { findHelpPage } from "@lintel/docs/help";
import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { BackLink } from "../design/BackLink.js";
import { buttonClasses } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { fullDocsUrl } from "./docsLinks.js";
import { HelpArticle } from "./HelpArticle.js";
import { HelpTopicList } from "./HelpTopicList.js";

interface HelpPageProps {
  /** The open topic, kept in the address (`/help?topic=using/media`) so it can be shared. */
  topic: string | undefined;
  /** Opens a topic, or the list when undefined. `anchor` is a heading on that page. */
  onOpenTopic: (topic: string | undefined, anchor?: string) => void;
  anchor?: string;
}

/** The Help section: every "Using Lintel" page, readable without leaving the admin. */
export function HelpPage({ topic, onOpenTopic, anchor }: HelpPageProps) {
  const page = topic ? findHelpPage(topic) : undefined;
  const fullDocsLink = (
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
      <>
        <LargeTitle
          title={t("help.pageTitle")}
          subtitle={t("help.pageSubtitle")}
          actions={fullDocsLink}
        />
        <HelpTopicList onOpenPage={(slug) => onOpenTopic(slug)} />
      </>
    );
  }

  return (
    <>
      <BackLink to="/help" search={{}}>
        {t("help.pageTitle")}
      </BackLink>
      <LargeTitle title={page.title} subtitle={page.description} actions={fullDocsLink} />
      <Card>
        <HelpArticle page={page} anchor={anchor} onOpenPage={onOpenTopic} titleLevel={1} />
      </Card>
    </>
  );
}
