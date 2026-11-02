import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Menu as MenuIcon } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { saveMenu } from "../menus/menus.api.js";
import { menuKeys, useMenu } from "../menus/menus.queries.js";
import { useCan } from "../session/SessionContext.js";

/** Where the website lists the shop's products. */
const SHOP_ADDRESS = "/shop";

/**
 * "Add Shop to your main menu", on the Shop home: the website had no way to the shop unless
 * someone added the link themselves. Offered while the main menu is arranged by hand and has
 * no link to the shop; one press adds it at the end.
 */
export function ShopMenuOffer() {
  const canChange = useCan("navigation:update");
  const menu = useMenu("main");
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const data = menu.data;
  const isOffered =
    canChange &&
    data !== undefined &&
    data.source === "items" &&
    !data.items.some((item) => item.url === SHOP_ADDRESS);
  if (state === "added") {
    return (
      <p role="status" className="flex items-center gap-2 text-footnote text-label">
        <CircleCheck aria-hidden="true" className="size-4 text-success" />
        {t("shop.menuOffer.added")}
      </p>
    );
  }
  if (!isOffered) return null;

  async function add() {
    if (!data) return;
    setState("adding");
    setProblem(null);
    try {
      const shopItem = {
        id: crypto.randomUUID(),
        label: t("shop.menuOffer.label"),
        entryId: null,
        url: SHOP_ADDRESS,
        newTab: false,
        children: [],
      };
      const saved = await saveMenu("main", { items: [...data.items, shopItem] });
      queryClient.setQueryData(menuKeys.menu("main"), saved);
      setState("added");
    } catch (error) {
      setProblem(describeError(error));
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4">
      <p className="flex items-start gap-2.5 text-body text-label">
        <MenuIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        {t("shop.menuOffer.text")}
      </p>
      <div>
        <Button variant="tinted" onClick={() => void add()} disabled={state === "adding"}>
          {t("shop.menuOffer.add")}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-footnote text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
