import { ArrowUpRight, LifeBuoy, Mail } from "lucide-react";
import { useBranding } from "../branding/brandingStore.js";
import { buttonClasses } from "../design/Button.js";
import { t } from "../i18n/strings.js";

/**
 * Who to ask for help, from Build → Admin branding: the agency's support link, email and own
 * guides. Shows nothing when none are set.
 */
export function SupportCard() {
  const { supportUrl, supportEmail, docsUrl } = useBranding();
  if (!supportUrl && !supportEmail && !docsUrl) return null;

  return (
    <section
      aria-labelledby="help-support-heading"
      className="mb-8 flex flex-col gap-4 rounded-card bg-surface p-6 hairline-ring"
    >
      <div className="flex items-start gap-3">
        <LifeBuoy
          aria-hidden="true"
          strokeWidth={1.75}
          className="mt-0.5 size-5 shrink-0 text-accent"
        />
        <div>
          <h2 id="help-support-heading" className="text-headline text-label">
            {t("help.support.title")}
          </h2>
          <p className="mt-1 text-body text-label-secondary">{t("help.support.description")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {docsUrl && <ExternalLink href={docsUrl} label={t("help.support.docs")} />}
        {supportUrl && <ExternalLink href={supportUrl} label={t("help.support.contact")} />}
        {supportEmail && (
          <a href={`mailto:${supportEmail}`} className={buttonClasses("tinted", "medium")}>
            <Mail aria-hidden="true" strokeWidth={2} className="size-4" />
            {t("help.support.email", { email: supportEmail })}
          </a>
        )}
      </div>
    </section>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses("tinted", "medium")}
    >
      {label}
      <ArrowUpRight aria-hidden="true" strokeWidth={2} className="size-4" />
      <span className="sr-only">{t("help.newTab")}</span>
    </a>
  );
}
