import { type StarterSite, starterSites } from "@lintel/builder-model";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button, buttonClasses } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useSiteAddress } from "../website/website.queries.js";
import {
  type AppliedStarterSite,
  addPagesToMainMenu,
  applyStarterSite,
} from "./starter-sites.api.js";
import { StarterSiteCard } from "./StarterSiteCard.js";

/**
 * Design, Templates: "Start from a template". Every starter site with its picture, pages and
 * colours; choosing one adds its pages to Pages (as drafts, or published) and, if wanted,
 * gives the website its colours and fonts. Afterwards each page opens in the page builder.
 */
export function TemplateLibraryPage() {
  const address = useSiteAddress();
  const siteAddress = address.data?.siteAddress ?? null;
  const [chosen, setChosen] = useState<StarterSite | null>(null);
  const [applied, setApplied] = useState<{ site: StarterSite; result: AppliedStarterSite } | null>(
    null,
  );

  return (
    <>
      <LargeTitle
        title={t("templates.title")}
        subtitle={t("templates.subtitle")}
        actions={
          <LinkButton variant="tinted" to="/design/blocks">
            {t("blocks.blocksLink")}
          </LinkButton>
        }
      />
      {applied && (
        <AppliedSummary site={applied.site} result={applied.result} siteAddress={siteAddress} />
      )}
      <ul
        aria-label={t("templates.listLabel")}
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {starterSites.map((site) => (
          <li key={site.id} className="flex">
            <StarterSiteCard site={site} siteAddress={siteAddress} onUse={() => setChosen(site)} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-footnote text-label-secondary">{t("templates.sectionsNote")}</p>
      {chosen && (
        <UseTemplateDialog
          site={chosen}
          onClose={() => setChosen(null)}
          onApplied={(result) => {
            setApplied({ site: chosen, result });
            setChosen(null);
          }}
        />
      )}
    </>
  );
}

function UseTemplateDialog({
  site,
  onClose,
  onApplied,
}: {
  site: StarterSite;
  onClose: () => void;
  onApplied: (result: AppliedStarterSite) => void;
}) {
  const queryClient = useQueryClient();
  const canChangeLook = useCan("settings:update");
  const canPublish = useCan("entries:publish");
  const [useTheme, setUseTheme] = useState(true);
  const [publish, setPublish] = useState(false);
  const apply = useMutation({
    mutationFn: () =>
      applyStarterSite(site.id, {
        useTheme: canChangeLook && useTheme,
        publish: canPublish && publish,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      onApplied(result);
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("templates.confirmTitle", { name: site.name })}
      description={t("templates.confirmText", { count: site.pages.length })}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("templates.cancel")}
          </Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending} data-autofocus>
            {apply.isPending ? t("templates.applying") : t("templates.apply")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {canChangeLook && (
          <Toggle
            label={t("templates.useTheme")}
            checked={useTheme}
            onCheckedChange={setUseTheme}
          />
        )}
        {canPublish && (
          <div className="flex flex-col gap-1">
            <Toggle
              label={t("templates.publish")}
              checked={publish}
              onCheckedChange={setPublish}
              describedBy="templates-publish-hint"
            />
            <p id="templates-publish-hint" className="text-caption text-label-secondary">
              {t("templates.publishHint")}
            </p>
          </div>
        )}
        {apply.isError && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(apply.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function AppliedSummary({
  site,
  result,
  siteAddress,
}: {
  site: StarterSite;
  result: AppliedStarterSite;
  siteAddress: string | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [result]);
  const published = result.pages.some((page) => page.published);
  return (
    <section
      aria-labelledby="templates-done"
      className="mb-8 flex flex-col gap-3 rounded-card bg-success/10 p-5 hairline-ring"
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 aria-hidden="true" className="size-5 text-success" />
        <h2
          id="templates-done"
          ref={heading}
          tabIndex={-1}
          className="text-headline text-label outline-none"
        >
          {t("templates.doneTitle", { name: site.name })}
        </h2>
      </div>
      <p className="text-footnote text-label-secondary">
        {published ? t("templates.donePublished") : t("templates.doneDrafts")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {result.pages.map((page) => (
          <li key={page.entryId} className="flex flex-col gap-1">
            <Link
              to="/content/$collection/$entryId/design/$field"
              params={{ collection: "pages", entryId: page.entryId, field: "design" }}
              className={buttonClasses("tinted", "medium")}
            >
              {t("templates.editDesign", { title: page.title })}
            </Link>
            {page.slug !== page.wantedSlug && (
              <span className="max-w-56 text-caption text-label-secondary">
                {t("templates.movedSlug", { slug: page.slug, wanted: page.wantedSlug })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <MenuNote result={result} />
      {published && siteAddress && (
        <a
          href={siteAddress}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
        >
          {t("templates.viewSite")}
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      )}
    </section>
  );
}

/** Whether the pages are in the main menu, and a way to add them when it had links. */
function MenuNote({ result }: { result: AppliedStarterSite }) {
  const queryClient = useQueryClient();
  const canEditMenus = useCan("navigation:update");
  const add = useMutation({
    mutationFn: () => addPagesToMainMenu(result.pages.map((page) => page.entryId)),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
  if (result.menuFilled || add.isSuccess) {
    return (
      <p role="status" className="text-footnote text-label-secondary">
        {add.isSuccess ? t("templates.addedToMenu") : t("templates.menuFilled")}
      </p>
    );
  }
  if (!result.menuHasLinks || !canEditMenus) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-footnote text-label-secondary">{t("templates.menuHasLinks")}</p>
      <Button variant="tinted" onClick={() => add.mutate()} disabled={add.isPending}>
        {add.isPending ? t("templates.addingToMenu") : t("templates.addToMenu")}
      </Button>
      {add.isError && (
        <p role="alert" className="text-footnote text-danger">
          {describeError(add.error)}
        </p>
      )}
    </div>
  );
}
