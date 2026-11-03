import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useLinkedPage } from "./pageLinks.queries.js";

interface LinkedPageFieldProps {
  /** The page the link points at. */
  entryId: string;
  /** What the field is called; "Page" unless the page is for something in particular. */
  label?: string;
  id?: string;
  className?: string;
}

/**
 * Where a link's address would be, for a link to a page chosen with "Choose a page…": the
 * page's title ("About"), never the stored reference. When the page has been deleted or
 * binned, it says so plainly; the site already shows the link's words without a link.
 */
export function LinkedPageField({ entryId, label, id, className }: LinkedPageFieldProps) {
  const page = useLinkedPage(entryId);
  const isGone = page.isSuccess && page.data === null;
  const title = page.data ? page.data.title || t("tree.untitled") : "";
  return (
    <TextField
      id={id}
      label={label ?? t("pageLinks.page")}
      value={page.isPending ? t("pageLinks.finding") : title}
      readOnly
      error={isGone ? t("pageLinks.gone") : undefined}
      hint={page.isError ? t("pageLinks.unknown") : undefined}
      aria-invalid={isGone || undefined}
      className={className}
    />
  );
}
