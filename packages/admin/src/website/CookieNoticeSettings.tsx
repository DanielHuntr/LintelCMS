import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { ChoosePageButton } from "../page-links/ChoosePageButton.js";
import { LinkedPageField } from "../page-links/LinkedPageField.js";
import type {
  CookieNoticeMode,
  CookieNoticePosition,
  CookieNoticeSettings as Settings,
} from "./website.api.js";

/**
 * "Cookie notice" in Settings → Your website. Automatic is the default and the advice: the
 * notice shows by itself while the site uses something that may set cookies (named here),
 * and not otherwise. Where it shows, and its words and privacy page, come after; the words
 * are tucked away, since the notice's own say what it needs to.
 */

const modes: readonly CookieNoticeMode[] = ["automatic", "always", "off"];
const positions: readonly CookieNoticePosition[] = ["bar", "corner"];

interface CookieNoticeSettingsProps {
  value: Settings;
  onChange: (value: Settings) => void;
  disabled: boolean;
  /** The services the site uses, by name, from the server. */
  serviceNames: readonly string[];
}

/** "YouTube", "YouTube and Vimeo", "Adobe Fonts, Vimeo and YouTube". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function CookieNoticeSettings({
  value,
  onChange,
  disabled,
  serviceNames,
}: CookieNoticeSettingsProps) {
  const change = (changes: Partial<Settings>) => !disabled && onChange({ ...value, ...changes });
  const names = joinNames(serviceNames);
  // Open at first when the site has its own words, so they are seen; then it's the person's.
  const [wordsOpen] = useState(() => hasOwnWords(value));

  return (
    <section
      aria-labelledby="cookie-notice-heading"
      className="flex flex-col gap-5 rounded-card bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cookie-notice-heading" className="text-title-3 text-label">
          {t("cookieNotice.heading")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("cookieNotice.hint")}</p>
      </div>

      <div className="flex flex-col items-start gap-2">
        <SegmentedControl<CookieNoticeMode>
          label={t("cookieNotice.mode")}
          value={value.mode}
          onChange={(mode) => change({ mode })}
          options={modes.map((mode) => ({ value: mode, label: t(`cookieNotice.mode.${mode}`) }))}
        />
        <ModeStatus mode={value.mode} names={names} />
      </div>

      {value.mode !== "off" && (
        <>
          <div className="flex flex-col items-start gap-1.5">
            <span aria-hidden="true" className="text-footnote font-medium text-label">
              {t("cookieNotice.position")}
            </span>
            <SegmentedControl<CookieNoticePosition>
              label={t("cookieNotice.position")}
              value={value.position}
              onChange={(position) => change({ position })}
              options={positions.map((position) => ({
                value: position,
                label: t(`cookieNotice.position.${position}`),
              }))}
            />
          </div>

          <details className="group" open={wordsOpen || undefined}>
            <summary className="w-fit cursor-pointer rounded-control text-footnote font-medium text-accent focus-visible:focus-ring">
              {t("cookieNotice.more")}
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <TextField
                label={t("cookieNotice.headingField")}
                value={value.heading}
                maxLength={80}
                placeholder={t("cookieNotice.headingPlaceholder")}
                disabled={disabled}
                onChange={(event) => change({ heading: event.target.value })}
              />
              <TextField
                label={t("cookieNotice.message")}
                value={value.message}
                maxLength={400}
                placeholder={t("cookieNotice.messagePlaceholder")}
                hint={t("cookieNotice.messageHint", { placeholder: "{services}" })}
                disabled={disabled}
                onChange={(event) => change({ message: event.target.value })}
              />
              <PrivacyPage
                pageId={value.privacyPageId}
                disabled={disabled}
                onChange={(privacyPageId) => change({ privacyPageId })}
              />
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function hasOwnWords(value: Settings): boolean {
  return value.heading !== "" || value.message !== "" || value.privacyPageId !== null;
}

/** One plain line under the choice: what the visitor will see, given what the site uses. */
function ModeStatus({ mode, names }: { mode: CookieNoticeMode; names: string }) {
  if (mode === "off") {
    return (
      <div className="flex items-start gap-3 rounded-card bg-warning/14 p-4 text-footnote text-label">
        <TriangleAlert
          aria-hidden="true"
          strokeWidth={2}
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <p>
          {t("cookieNotice.offWarning")}{" "}
          <span className="text-label-secondary">{t("cookieNotice.notAdvice")}</span>
        </p>
      </div>
    );
  }
  const text =
    mode === "always"
      ? names
        ? t("cookieNotice.alwaysUses", { names })
        : t("cookieNotice.always")
      : names
        ? t("cookieNotice.uses", { names })
        : t("cookieNotice.usesNothing");
  return <p className="text-footnote text-label-secondary">{text}</p>;
}

function PrivacyPage({
  pageId,
  disabled,
  onChange,
}: {
  pageId: string | null;
  disabled: boolean;
  onChange: (pageId: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {pageId ? (
        <LinkedPageField entryId={pageId} label={t("cookieNotice.privacyPage")} />
      ) : (
        <TextField
          label={t("cookieNotice.privacyPage")}
          value=""
          placeholder={t("cookieNotice.privacyPageNone")}
          readOnly
        />
      )}
      {!disabled && (
        <div className="flex gap-4">
          <ChoosePageButton onChoose={(page) => onChange(page.id)} />
          {pageId && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-6 self-start rounded-[6px] text-footnote font-medium text-label-secondary underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
            >
              {t("cookieNotice.privacyPageRemove")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
