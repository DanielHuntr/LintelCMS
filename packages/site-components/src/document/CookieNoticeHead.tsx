import { scriptSafeJson } from "./DesignHead.js";

/**
 * The cookie notice, prepared by the server for a site that asks visitors about cookies:
 * the settings its script reads (see CookieNoticePage in @lintel/builder-model) and the
 * script's address. Sites without the notice get neither.
 */
export interface CookieNoticeHead {
  settings: unknown;
  scriptUrl: string;
}

/** The id the settings are found by; the same as `cookieNoticeElementId` in the builder model. */
export const COOKIE_NOTICE_ELEMENT_ID = "lintel-cookie-notice";

export function CookieNoticeTags({ notice }: { notice: CookieNoticeHead | undefined }) {
  if (!notice) return null;
  return (
    <>
      <script
        type="application/json"
        id={COOKIE_NOTICE_ELEMENT_ID}
        dangerouslySetInnerHTML={{ __html: scriptSafeJson(notice.settings) }}
      />
      <script src={notice.scriptUrl} defer />
    </>
  );
}
