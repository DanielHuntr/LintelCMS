import { useMutation } from "@tanstack/react-query";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useProducts } from "./shop.queries.js";
import { useMarkets, useShippingZones } from "./shopSettings.queries.js";
import { startTestSession } from "./testCheckout.api.js";

/**
 * Opens the website in a test session, in a new tab: this browser can place test orders, with
 * no payment account and no money taken. `isPlain` leaves out the card, for inside another.
 */
export function TryYourShop({ isPlain = false }: { isPlain?: boolean }) {
  const canTry = useCan("commerce:update");
  const markets = useMarkets();
  const zones = useShippingZones();
  const products = useProducts({ status: "active" });
  const start = useMutation({ mutationFn: startTestSession });
  const isReady =
    (markets.data?.length ?? 0) > 0 &&
    (zones.data?.some((zone) => zone.rates.length > 0) ?? false) &&
    (products.data?.total ?? 0) > 0;

  if (!canTry) return null;

  function open() {
    // Opened before the request, because browsers block tabs opened after waiting for one.
    const tab = window.open("", "_blank");
    start.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (tab) tab.location.href = url;
        else window.location.assign(url);
      },
      onError: () => tab?.close(),
    });
  }

  const content = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-headline text-label">{t("shop.tryShop.title")}</h2>
        <p className="text-footnote text-label-secondary">
          {isReady ? t("shop.tryShop.body") : t("shop.tryShop.notReady")}
        </p>
      </div>
      <div>
        <Button variant="tinted" disabled={!isReady || start.isPending} onClick={open}>
          {start.isPending ? t("shop.tryShop.opening") : t("shop.tryShop.action")}
        </Button>
      </div>
      {start.error && (
        <p role="alert" className="text-footnote text-danger">
          {describeError(start.error)}
        </p>
      )}
    </div>
  );
  return isPlain ? content : <Card>{content}</Card>;
}
