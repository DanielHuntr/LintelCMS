import { type StarterSite, starterSites } from "@lintel/builder-model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button, buttonClasses } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
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
  type ExistingPages,
  type ExistingPagesChoice,
  getExistingPages,
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
  const canUseTemplates = useCan("builder:design");
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
            <StarterSiteCard
              site={site}
              siteAddress={siteAddress}
              {...(canUseTemplates && { onUse: () => setChosen(site) })}
            />
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
  const canDelete = useCan("entries:delete");
  // Left alone, the template's look comes with it when it replaces the site's pages (or the
  // site has none), and not when its pages go beside the site's own.
  const [themeChoice, setUseTheme] = useState<boolean | null>(null);
  const [publish, setPublish] = useState(false);
  const [choice, setChoice] = useState<ExistingPagesChoice>("alongside");
  const existing = useQuery({
    queryKey: ["starter-sites", site.id, "existing-pages"],
    queryFn: () => getExistingPages(site.id),
  });
  const hasPages = (existing.data?.pageCount ?? 0) > 0;
  const useTheme = themeChoice ?? !(hasPages && choice === "alongside");
  const addingBeside = hasPages && choice === "alongside";
  const pageCount = addingBeside && existing.data ? existing.data.addedCount : site.pages.length;
  const apply = useMutation({
    mutationFn: () =>
      applyStarterSite(site.id, {
        useTheme: canChangeLook && useTheme,
        publish: canPublish && publish,
        existingPages: hasPages ? choice : undefined,
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
      description={t("templates.confirmText", { count: pageCount })}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("templates.cancel")}
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || existing.isPending}
            data-autofocus
          >
            {apply.isPending ? t("templates.applying") : t("templates.apply")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {existing.isPending && (
          <p className="text-footnote text-label-secondary">{t("templates.existing.loading")}</p>
        )}
        {existing.data && hasPages && (
          <ExistingPagesChoiceField
            existing={existing.data}
            choice={choice}
            canReplace={canDelete}
            onChange={setChoice}
          />
        )}
        {canChangeLook && (
          <div className="flex flex-col gap-1">
            <Toggle
              label={t("templates.useTheme")}
              checked={useTheme}
              onCheckedChange={setUseTheme}
              describedBy="templates-theme-hint"
            />
            <p id="templates-theme-hint" className="text-caption text-label-secondary">
              {t("templates.useThemeHint")}
            </p>
          </div>
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

/**
 * The site has pages already: ask, in plain words, whether the template's go beside them or
 * replace them. Cancel is the dialog's own button; nothing is ever doubled silently.
 */
function ExistingPagesChoiceField({
  existing,
  choice,
  canReplace,
  onChange,
}: {
  existing: ExistingPages;
  choice: ExistingPagesChoice;
  canReplace: boolean;
  onChange: (choice: ExistingPagesChoice) => void;
}) {
  const name = useId();
  const example = existing.clashes[0]?.title ?? "";
  const options: { value: ExistingPagesChoice; label: string; hint: string; disabled?: boolean }[] =
    [
      {
        value: "alongside",
        label: t("templates.existing.alongside"),
        hint: [
          t("templates.existing.alongsideHint"),
          existing.hasHome ? t("templates.existing.homeSkipped") : "",
          existing.clashes.length > 0
            ? t("templates.existing.alongsideClashes", { count: existing.clashes.length, example })
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        value: "replace",
        label: t("templates.existing.replace"),
        hint: canReplace
          ? t("templates.existing.replaceHint")
          : t("templates.existing.replaceNotAllowed"),
        disabled: !canReplace,
      },
    ];
  return (
    <fieldset className="flex flex-col gap-2 rounded-card bg-warning/10 p-4">
      <legend className="sr-only">{t("templates.existing.choose")}</legend>
      <p className="text-body font-semibold text-label">{t("templates.existing.title")}</p>
      <p className="text-footnote text-label-secondary">
        {t("templates.existing.description", { count: existing.pageCount })}
      </p>
      {options.map((option) => (
        <label
          key={option.value}
          className={classNames(
            "flex cursor-pointer items-start gap-3 rounded-control px-3 py-2.5 has-focus-visible:focus-ring",
            choice === option.value ? "bg-surface ring-1 ring-accent" : "bg-surface/60",
            option.disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={choice === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
            className="mt-1 size-4 accent-(--color-accent-fill)"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-medium text-label">{option.label}</span>
            <span className="text-footnote text-label-secondary">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
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
        {result.skippedHome && ` ${t("templates.result.skippedHome")}`}
        {result.replacedCount > 0 &&
          ` ${t("templates.result.replaced", { count: result.replacedCount })}`}
        {result.featuresSwitchedOn.length > 0 &&
          ` ${t("templates.result.featuresOn", { features: result.featuresSwitchedOn.join(", ") })}`}
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
          className="inline-flex w-fit items-center gap-1.5 text-footnote font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
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
