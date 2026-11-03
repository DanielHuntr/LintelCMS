import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { isTreeHintDismissed, rememberTreeHintDismissed } from "./treeState.js";

/**
 * The first-time note on how the tree works: why pages sit under Home, and what that does to
 * their addresses. Once dismissed it stays away in this browser; the key and Help still say it.
 */
export function TreeHint({ canMovePages }: { canMovePages: boolean }) {
  const [isDismissed, setIsDismissed] = useState(isTreeHintDismissed);
  if (isDismissed) return null;

  return (
    <section
      aria-labelledby="tree-hint-title"
      className="mx-1 mt-1 mb-2 flex flex-col items-start gap-1.5 rounded-card bg-surface px-3 py-3 hairline-ring"
    >
      <h3 id="tree-hint-title" className="text-footnote font-semibold text-label">
        {t("tree.hint.title")}
      </h3>
      <p className="text-footnote text-label-secondary">{t("tree.hint.addresses")}</p>
      {canMovePages && (
        <p className="text-footnote text-label-secondary">{t("tree.hint.moving")}</p>
      )}
      <div className="mt-1 flex items-center gap-3">
        <Button
          size="small"
          variant="tinted"
          onClick={() => {
            rememberTreeHintDismissed();
            setIsDismissed(true);
          }}
        >
          {t("tree.hint.dismiss")}
        </Button>
        <Link
          to="/help"
          search={{ topic: "using/content-tree" }}
          className="text-footnote font-medium text-label underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring"
        >
          {t("tree.hint.learnMore")}
        </Link>
      </div>
    </section>
  );
}
