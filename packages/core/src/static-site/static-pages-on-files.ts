import { SITE_API_BASE } from "../website/page-data.service.js";
import { FORM_SCRIPT_PATH, type FormEndpoints } from "../website/site-forms.service.js";

/**
 * What changes in a page drawn by the live site's code when it is saved as a file.
 *
 * Forms made in the page builder post to the website's own `/_lintel/api/forms/...`, with
 * an anti-spam token drawn into the page. A folder of files has no `/_lintel/api`, and a
 * token drawn at publish time would be stale by the time anyone fills the form in, so each
 * such form is pointed at the form endpoints (the PHP companion, or Lintel's own API) and
 * fetches a fresh token when the page opens, like a Form section does.
 *
 * Shop elements in designs talk to the storefront API, which only a running Lintel has;
 * they are left as they are, and the export says which pages have them.
 */

const BUILDER_FORM_ACTION = new RegExp(
  `<form([^>]*?) action="${SITE_API_BASE.replace(/\//g, "\\/")}\\/forms\\/([^"/]+)\\/submissions"`,
  "g",
);

const SHOP_BEHAVIOURS = ["add-to-cart", "cart", "checkout-link", "order-confirmation"];

/** The page with its builder forms posting to `endpoints`, and the token script added. */
export function pointFormsAt(html: string, endpoints: FormEndpoints): string {
  let found = false;
  const pointed = html.replace(
    BUILDER_FORM_ACTION,
    (_match, attributes: string, handle: string) => {
      found = true;
      const name = decodeURIComponent(handle);
      return `<form${attributes} action="${escapeAttribute(endpoints.action(name))}" data-lintel-token-url="${escapeAttribute(endpoints.tokenUrl(name))}"${endpoints.plainPost ? " data-plain-post" : ""}`;
    },
  );
  if (!found || pointed.includes(`src="${FORM_SCRIPT_PATH}"`)) return pointed;
  const script = `<script src="${FORM_SCRIPT_PATH}" defer></script>`;
  const bodyEnd = pointed.lastIndexOf("</body>");
  return bodyEnd === -1
    ? pointed + script
    : `${pointed.slice(0, bodyEnd)}${script}${pointed.slice(bodyEnd)}`;
}

/** Whether a page has shop elements that need a running Lintel (the basket, checkout). */
export function hasLiveShopElements(html: string): boolean {
  return SHOP_BEHAVIOURS.some((name) => html.includes(`data-behaviour="${name}"`));
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
