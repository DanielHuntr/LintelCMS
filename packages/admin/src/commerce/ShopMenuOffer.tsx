import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Menu as MenuIcon } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { saveMenu } from "../menus/menus.api.js";
import { menuKeys, useMenu } from "../menus/menus.queries.js";
import type { Menu, MenuItem } from "../menus/menus.types.js";
import { useCan } from "../session/SessionContext.js";

/** Where the website lists the shop's products. */
const SHOP_ADDRESS = "/shop";

export interface ShopMenuOffer {
  /** The main menu is arranged by hand and has no link to the shop yet. */
  isOffered: boolean;
  /** Pressed, and saved: the menu links to the shop now. */
  isAdded: boolean;
  isAdding: boolean;
  /** Menu links whose page was deleted. The menu can't be saved with them. */
  brokenCount: number;
  problem: string | null;
  add: () => Promise<void>;
}

/**
 * "Add Shop to your main menu": the website had no way to the shop unless someone added the
 * link themselves (LINTEL-UX-009). Offered while the main menu is arranged by hand and has no
 * link to the shop; one press adds it at the end.
 */
export function useShopMenuOffer(): ShopMenuOffer {
  const canChange = useCan("navigation:update");
  const menu = useMenu("main");
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const data = isMenu(menu.data) ? menu.data : undefined;
  const isOffered =
    canChange &&
    data !== undefined &&
    data.source === "items" &&
    !data.items.some((item) => item.url === SHOP_ADDRESS);
  const brokenCount = data ? findBrokenLinks(data).length : 0;

  async function add() {
    if (!data) return;
    setState("adding");
    setProblem(null);
    try {
      const shopItem: MenuItem = {
        id: crypto.randomUUID(),
        label: t("shop.menuOffer.label"),
        entryId: null,
        url: SHOP_ADDRESS,
        newTab: false,
        children: [],
      };
      // A link to a deleted page stops the menu saving; the row says it will go.
      const items = [...withoutBrokenLinks(data.items, data), shopItem];
      const saved = await saveMenu("main", { items });
      queryClient.setQueryData(menuKeys.menu("main"), saved);
      setState("added");
    } catch (error) {
      setProblem(describeError(error));
      setState("idle");
    }
  }

  return {
    isOffered: isOffered && state !== "added",
    isAdded: state === "added",
    isAdding: state === "adding",
    brokenCount,
    problem,
    add,
  };
}

/** The offer as a row of the Shop home's setup list. */
export function ShopMenuStep({ offer }: { offer: ShopMenuOffer }) {
  if (offer.isAdded) {
    return (
      <li className="ps-4">
        <div className="flex items-center gap-3 py-3 pe-4 [li+li>&]:hairline-top">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-success" />
          <p role="status" className="text-body text-label">
            {t("shop.menuOffer.added")}
          </p>
        </div>
      </li>
    );
  }
  if (!offer.isOffered) return null;
  const description =
    offer.brokenCount > 0
      ? t("shop.menuOffer.removesBroken", { count: offer.brokenCount })
      : t("shop.menuOffer.text");
  return (
    <li className="ps-4">
      <div className="flex flex-col gap-3 py-3 pe-4 [li+li>&]:hairline-top sm:flex-row sm:items-center">
        <span className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-label-tertiary text-on-accent">
            <MenuIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex flex-wrap items-center gap-2 text-body text-label">
              {t("shop.menuOffer.step")}
              <Badge tone="neutral">{t("shop.setup.optional")}</Badge>
            </span>
            <span className="text-footnote text-label-secondary">{description}</span>
            {offer.problem && (
              <span role="alert" className="text-footnote text-danger">
                {offer.problem}
              </span>
            )}
          </span>
        </span>
        <Button
          variant="tinted"
          size="small"
          onClick={() => void offer.add()}
          disabled={offer.isAdding}
        >
          {t("shop.menuOffer.add")}
        </Button>
      </div>
    </li>
  );
}

function isMenu(value: unknown): value is Menu {
  return typeof value === "object" && value !== null && "items" in value && "source" in value;
}

function findBrokenLinks(menu: Menu): MenuItem[] {
  const broken: MenuItem[] = [];
  const visit = (items: MenuItem[]) => {
    for (const item of items) {
      if (item.entryId !== null && !(item.entryId in menu.linkedEntries)) broken.push(item);
      visit(item.children);
    }
  };
  visit(menu.items);
  return broken;
}

function withoutBrokenLinks(items: MenuItem[], menu: Menu): MenuItem[] {
  return items
    .filter((item) => item.entryId === null || item.entryId in menu.linkedEntries)
    .map((item) => ({ ...item, children: withoutBrokenLinks(item.children, menu) }));
}
