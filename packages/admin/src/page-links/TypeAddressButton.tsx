import { t } from "../i18n/strings.js";

/** "Type an address instead": turns a link to a chosen page back into a typed address. */
export function TypeAddressButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-6 self-start rounded-[6px] text-footnote font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
    >
      {t("pageLinks.typeAddress")}
    </button>
  );
}
