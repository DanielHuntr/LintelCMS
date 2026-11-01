import { t } from "../i18n/strings.js";
import { useAbout } from "./updates.queries.js";

/** "Lintel 1.0.0", for the foot of Help and the help panel. Nothing until it's known. */
export function LintelVersion({ className }: { className?: string }) {
  const about = useAbout();
  if (!about.data) return null;
  return <p className={className}>{t("about.footer", { version: about.data.version })}</p>;
}
