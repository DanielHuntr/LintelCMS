import { LoaderCircle } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useUpdateStatus } from "./updates.queries.js";

/** Across the top of every screen while an update is under way, for everyone signed in. */
export function UpdatingBanner() {
  const status = useUpdateStatus();
  if (!status.data?.updating) return null;
  return (
    <div
      role="status"
      className="fixed top-3 inset-e-16 inset-s-16 z-20 md:inset-s-[264px] flex items-center gap-2 rounded-control bg-warning/15 px-4 py-2 text-footnote text-label shadow-float backdrop-blur-xl"
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-4 shrink-0 text-warning motion-safe:animate-spin"
      />
      {t("updates.banner", { version: status.data.version ?? "" })}
    </div>
  );
}
