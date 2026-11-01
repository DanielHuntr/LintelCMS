import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Previous and next, with where you are between them. Hidden when everything fits on one page. */
export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={t("pagination.label")} className="mt-4 flex items-center justify-center gap-3">
      <Button
        variant="plain"
        size="small"
        icon={<ChevronLeft aria-hidden="true" />}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t("pagination.previous")}
      </Button>
      <p className="text-footnote text-label-secondary tabular-nums">
        {t("pagination.position", { page, count: pageCount })}
      </p>
      <Button
        variant="plain"
        size="small"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t("pagination.next")}
        <ChevronRight aria-hidden="true" className="-me-1 size-[1.1em]" />
      </Button>
    </nav>
  );
}
