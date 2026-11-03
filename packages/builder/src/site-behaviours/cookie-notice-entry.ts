import { setUpCookieNotice } from "./cookie-notice.js";

/**
 * The cookie notice's script: only published pages of sites that ask visitors about cookies
 * load it (deferred). See cookie-notice.ts.
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setUpCookieNotice(document));
} else {
  setUpCookieNotice(document);
}
