import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import { describeLine } from "../checkouts/line-names.js";
import { formatMoney } from "../money/money-format.js";
import { TEST_PAYMENT_PATH } from "./test-payment-provider.js";

/**
 * The little HTML the test checkout adds to the website: the payment page, the pages shown
 * when something is refused, and the banner on every page of a test session. They carry
 * their own styles, so a site's design can't hide them or be disturbed by them.
 */

export const TEST_SESSION_END_PATH = "/_lintel/shop-test/end";

const PAGE_STYLES = `
:root { color-scheme: light dark; --ink: #1d1d1f; --quiet: #5f5f64; --paper: #f5f5f7; --card: #fff; --line: #d9d9de; --go: #1a7f42; }
@media (prefers-color-scheme: dark) { :root { --ink: #f5f5f7; --quiet: #b0b0b6; --paper: #161617; --card: #232325; --line: #3a3a3d; --go: #1f8a4c; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 16px; background: var(--paper); color: var(--ink); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
main { max-width: 440px; margin: 0 auto; padding: 24px; background: var(--card); border-radius: 16px; }
h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.25; }
p { margin: 0 0 16px; color: var(--quiet); }
ul { margin: 0 0 16px; padding: 0; list-style: none; border-top: 1px solid var(--line); }
li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--line); }
li.total { font-weight: 600; }
form { display: flex; flex-direction: column; gap: 8px; }
button { min-height: 44px; padding: 10px 16px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
button.pay { border-color: var(--go); background: var(--go); color: #fff; }
button:focus-visible, a:focus-visible { outline: 3px solid #4c8dff; outline-offset: 2px; }
a { color: inherit; }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${PAGE_STYLES}</style></head><body><main>${body}</main></body></html>`;
}

/** Stands in for the provider's payment page, with a way to try both outcomes. */
export function testPaymentPage(checkout: CheckoutRow): string {
  const money = (amount: number) => formatMoney({ amount, currency: checkout.currency });
  const lines = checkout.lines.map(
    (line) =>
      `<li><span>${line.quantity} × ${escapeHtml(describeLine(line.productTitle, line.variantTitle))}</span><span>${escapeHtml(money(line.subtotalAmount))}</span></li>`,
  );
  return page(
    "Test payment",
    `<h1>Test payment</h1>
<p>This stands in for the payment page. No money is taken, and no card is needed.</p>
<ul>${lines.join("")}<li><span>Delivery: ${escapeHtml(checkout.shippingLine.name)}</span><span>${escapeHtml(money(checkout.shippingAmount))}</span></li><li class="total"><span>Total</span><span>${escapeHtml(money(checkout.totalAmount))}</span></li></ul>
<form method="post" action="${TEST_PAYMENT_PATH}">
<input type="hidden" name="checkout" value="${escapeHtml(checkout.id)}">
<button class="pay" type="submit" name="outcome" value="paid">Pay (test)</button>
<button type="submit" name="outcome" value="failed">Make the payment fail</button>
</form>`,
  );
}

export function testSessionRefusedPage(): string {
  return page(
    "This test link has ended",
    `<h1>This test link has ended</h1>
<p>Test links only work for a few minutes. Open Try your shop in the admin to get a new one.</p>`,
  );
}

export function testPaymentGonePage(): string {
  return page(
    "This test payment has ended",
    `<h1>This test payment has ended</h1>
<p>It timed out, or it has already been finished. <a href="/cart">Go back to the basket</a> to try again.</p>`,
  );
}

const BANNER_STYLE =
  "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 16px;padding:10px 16px;background:#1d1d1f;color:#fff;font:500 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center";
const BANNER_LINK_STYLE = "color:#fff;text-decoration:underline;text-underline-offset:2px";
const BANNER_BUTTON_STYLE = `all:unset;cursor:pointer;${BANNER_LINK_STYLE}`;

export interface BannerMessage {
  text: string;
  link?: { label: string; url: string };
}

/** Says what's going on, on every page of a test session, with a way out. */
export function testSessionBanner(message: BannerMessage): string {
  const link = message.link
    ? `<a href="${escapeHtml(message.link.url)}" style="${BANNER_LINK_STYLE}">${escapeHtml(message.link.label)}</a>`
    : "";
  return `<div aria-hidden="true" style="height:64px"></div><aside aria-label="Test session" data-lintel-test-banner style="${BANNER_STYLE}"><span role="status">${escapeHtml(message.text)}</span>${link}<form method="post" action="${TEST_SESSION_END_PATH}" style="margin:0"><button type="submit" style="${BANNER_BUTTON_STYLE}">End test</button></form></aside>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
