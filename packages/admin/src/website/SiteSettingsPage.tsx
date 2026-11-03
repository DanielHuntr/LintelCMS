import { BookOpen, ExternalLink, LayoutTemplate, Palette, type LucideIcon } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button, buttonClasses } from "../design/Button.js";
import { ChoiceCardGroup } from "../design/ChoiceCardGroup.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useAsset } from "../media/media.queries.js";
import { MediaPicker } from "../media/MediaPicker.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { ColourChoice } from "./ColourChoice.js";
import { FontPairingChoice } from "./FontPairingChoice.js";
import { ThemeFontChoice } from "../site-fonts/ThemeFontChoice.js";
import type {
  ColourScheme,
  CookieNotice,
  CookieNoticeSettings as NoticeSettings,
  CornerStyle,
  SiteTheme,
  SpacingScale,
  Website,
} from "./website.api.js";
import {
  useCookieNotice,
  useSiteEffects,
  useUpdateCookieNotice,
  useUpdateSiteEffects,
  useUpdateWebsite,
  useWebsite,
} from "./website.queries.js";
import { PageFlowSettings, type PageFlow } from "./PageFlowSettings.js";
import { CookieNoticeSettings } from "./CookieNoticeSettings.js";

/** /settings/site: the built-in website's template, theme, logo, page transitions and address. */
export function SiteSettingsPage() {
  const website = useWebsite();
  const effects = useSiteEffects();
  const cookieNotice = useCookieNotice();

  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("website.title")} subtitle={t("website.subtitle")} />
      {website.isError && (
        <LoadError error={website.error} onRetry={() => void website.refetch()} />
      )}
      {website.isPending && (
        <LoadingRegion label={t("website.loading")}>
          <Skeleton className="h-96 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {website.data && !effects.isPending && !cookieNotice.isPending && (
        <SiteSettingsForm
          initial={website.data}
          initialFlow={effects.data}
          initialNotice={cookieNotice.data}
        />
      )}
    </>
  );
}

interface FormValues {
  template: string;
  theme: SiteTheme;
  logoAssetId: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  siteAddress: string;
}

const templateIcons: Record<string, LucideIcon> = { clean: LayoutTemplate, journal: BookOpen };

function SiteSettingsForm({
  initial,
  initialFlow,
  initialNotice,
}: {
  initial: Website;
  /** Undefined when the site's motion settings couldn't be read: the section is left out. */
  initialFlow: PageFlow | undefined;
  /** The same for the cookie notice. */
  initialNotice: CookieNotice | undefined;
}) {
  const [values, setValues] = useState<FormValues>({
    template: initial.template,
    theme: initial.theme,
    logoAssetId: initial.logoAssetId,
    headingFont: initial.headingFont,
    bodyFont: initial.bodyFont,
    siteAddress: initial.siteAddress,
  });
  const [flow, setFlow] = useState<PageFlow | undefined>(
    initialFlow && { pageTransition: initialFlow.pageTransition, intro: initialFlow.intro },
  );
  const [notice, setNotice] = useState<NoticeSettings | undefined>(initialNotice?.settings);
  const update = useUpdateWebsite();
  const updateFlow = useUpdateSiteEffects();
  const updateNotice = useUpdateCookieNotice();
  const services = (updateNotice.data ?? initialNotice)?.services ?? [];
  const canChange = useCan("settings:update");
  const siteName = useSession().siteName ?? "";
  const logo = useAsset(values.logoAssetId);
  const saved = update.data ?? initial;

  const resetSaves = () => {
    update.reset();
    updateFlow.reset();
    updateNotice.reset();
  };
  const change = (changes: Partial<FormValues>) => {
    resetSaves();
    setValues((current) => ({ ...current, ...changes }));
  };
  const changeFlow = (next: PageFlow) => {
    resetSaves();
    setFlow(next);
  };
  const changeNotice = (next: NoticeSettings) => {
    resetSaves();
    setNotice(next);
  };
  const saving = update.isPending || updateFlow.isPending || updateNotice.isPending;
  const failed = [update, updateFlow, updateNotice].find((mutation) => mutation.isError);
  const changeTheme = (changes: Partial<SiteTheme>) =>
    change({ theme: { ...values.theme, ...changes } });

  /** A new template brings its own look; the light or dark choice stays. */
  function chooseTemplate(templateId: string) {
    const template = initial.templates.find(({ id }) => id === templateId);
    change({
      template: templateId,
      theme: template
        ? { ...template.defaultTheme, colourScheme: values.theme.colourScheme }
        : values.theme,
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (flow) updateFlow.mutate(flow);
    if (notice) updateNotice.mutate(notice);
    update.mutate({
      template: values.template,
      ...values.theme,
      logoAssetId: values.logoAssetId,
      headingFont: values.headingFont,
      bodyFont: values.bodyFont,
      siteAddress: values.siteAddress,
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-8">
      <SiteAddressCard website={saved} />

      <section aria-labelledby="site-template-heading" className="flex flex-col gap-3">
        <h2 id="site-template-heading" className="text-title-3 text-label">
          {t("website.templateHeading")}
        </h2>
        <ChoiceCardGroup
          labelledBy="site-template-heading"
          value={values.template}
          onChange={canChange ? chooseTemplate : () => undefined}
          options={initial.templates.map((template) => ({
            value: template.id,
            title: template.name,
            description: template.description,
            icon: templateIcons[template.id] ?? Palette,
          }))}
        />
      </section>

      <section
        aria-labelledby="site-theme-heading"
        className="flex flex-col gap-6 rounded-card bg-surface p-6"
      >
        <h2 id="site-theme-heading" className="text-title-3 text-label">
          {t("website.themeHeading")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <ColourChoice
            label={t("website.brandColour")}
            hint={t("website.brandColourHint")}
            value={values.theme.brandColour}
            disabled={!canChange}
            onChange={(brandColour) => changeTheme({ brandColour })}
          />
          <ColourChoice
            label={t("website.accentColour")}
            hint={t("website.accentColourHint")}
            value={values.theme.accentColour}
            disabled={!canChange}
            onChange={(accentColour) => changeTheme({ accentColour })}
          />
        </div>
        <FontPairingChoice
          pairings={initial.fontPairings}
          value={values.theme.fontPairing}
          disabled={!canChange}
          onChange={(fontPairing) => changeTheme({ fontPairing })}
        />
        <ThemeFontChoice
          headingFont={values.headingFont}
          bodyFont={values.bodyFont}
          disabled={!canChange}
          onChange={change}
        />
        <LabelledSegments label={t("website.appearance")}>
          <SegmentedControl<ColourScheme>
            label={t("website.appearance")}
            value={values.theme.colourScheme}
            onChange={(colourScheme) => canChange && changeTheme({ colourScheme })}
            options={[
              { value: "auto", label: t("website.appearance.auto") },
              { value: "light", label: t("website.appearance.light") },
              { value: "dark", label: t("website.appearance.dark") },
            ]}
          />
        </LabelledSegments>
        <div className="grid gap-6 sm:grid-cols-2">
          <LabelledSegments label={t("website.corners")}>
            <SegmentedControl<CornerStyle>
              label={t("website.corners")}
              value={values.theme.cornerStyle}
              onChange={(cornerStyle) => canChange && changeTheme({ cornerStyle })}
              options={[
                { value: "square", label: t("website.corners.square") },
                { value: "soft", label: t("website.corners.soft") },
                { value: "round", label: t("website.corners.round") },
              ]}
            />
          </LabelledSegments>
          <LabelledSegments label={t("website.spacing")}>
            <SegmentedControl<SpacingScale>
              label={t("website.spacing")}
              value={values.theme.spacing}
              onChange={(spacing) => canChange && changeTheme({ spacing })}
              options={[
                { value: "compact", label: t("website.spacing.compact") },
                { value: "comfortable", label: t("website.spacing.comfortable") },
                { value: "airy", label: t("website.spacing.airy") },
              ]}
            />
          </LabelledSegments>
        </div>
        <MediaPicker
          label={t("website.logo")}
          value={values.logoAssetId}
          onChange={(logoAssetId) => canChange && change({ logoAssetId })}
        />
        <p className="-mt-4 text-footnote text-label-secondary">{t("website.logoHint")}</p>
      </section>

      {flow && (
        <PageFlowSettings
          value={flow}
          onChange={changeFlow}
          disabled={!canChange}
          siteName={siteName}
          logoUrl={values.logoAssetId ? (logo.data?.url ?? null) : null}
        />
      )}

      {notice && (
        <CookieNoticeSettings
          value={notice}
          onChange={changeNotice}
          disabled={!canChange}
          serviceNames={services.map((service) => service.name)}
        />
      )}

      <section className="flex flex-col gap-5 rounded-card bg-surface p-6">
        <TextField
          label={t("website.siteAddress")}
          hint={t("website.siteAddressHint")}
          placeholder={initial.builtInSiteUrl ?? "https://www.example.com"}
          type="url"
          inputMode="url"
          value={values.siteAddress}
          disabled={!canChange}
          onChange={(event) => change({ siteAddress: event.target.value })}
        />
      </section>

      {canChange && (
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-footnote text-label-secondary">
            {failed ? (
              <span className="text-danger">{describeError(failed.error)}</span>
            ) : update.isSuccess &&
              (!flow || updateFlow.isSuccess) &&
              (!notice || updateNotice.isSuccess) ? (
              t("website.saved")
            ) : (
              ""
            )}
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? t("website.saving") : t("website.save")}
          </Button>
        </div>
      )}
    </form>
  );
}

function LabelledSegments({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span aria-hidden="true" className="text-footnote font-medium text-label">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Where the site is, with a button to open it. */
function SiteAddressCard({ website }: { website: Website }) {
  const address = website.effectiveSiteAddress;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card bg-surface p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-headline text-label">
          {address ? t("website.liveAt") : t("website.notServed")}
        </p>
        <p className="truncate text-footnote text-label-secondary">
          {address ?? t("website.notServedHint")}
        </p>
      </div>
      {address && (
        <a
          href={address}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses("filled", "medium")}
        >
          <span className="-ms-0.5 flex [&>svg]:size-[1.1em]">
            <ExternalLink aria-hidden="true" />
          </span>
          {t("website.open")}
          <span className="sr-only"> {t("website.opensInNewTab")}</span>
        </a>
      )}
    </div>
  );
}
