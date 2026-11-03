import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useCookieNotice } from "./website.queries.js";

/**
 * Under "Count … only after they accept" (Visitors, A/B tests): with the cookie notice off,
 * nobody is ever asked, so nobody would be counted. Says so, with the way to the notice.
 */
export function ConsentNoticeOffWarning({ waitsForConsent }: { waitsForConsent: boolean }) {
  const notice = useCookieNotice();
  if (!waitsForConsent || notice.data?.settings.mode !== "off") return null;
  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-3 rounded-card bg-warning/14 p-4 text-footnote text-label"
    >
      <TriangleAlert
        aria-hidden="true"
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0 text-warning"
      />
      <p>
        {t("cookieNotice.offNobodyCounted")}{" "}
        <Link to="/settings/site" className="text-accent">
          {t("cookieNotice.openSettings")}
        </Link>
      </p>
    </div>
  );
}
