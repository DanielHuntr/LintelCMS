import { useState } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { PickedPage } from "./pageLinks.queries.js";
import { PagePickerDialog } from "./PagePickerDialog.js";

/**
 * "Choose a page…", a plain text action beside a link's address. It opens the page picker
 * and hands back the chosen page; typing a full web address in the field still works.
 */
export function ChoosePageButton({
  onChoose,
  className,
}: {
  onChoose: (page: PickedPage) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={classNames(
          "min-h-6 self-start rounded-[6px] text-footnote font-medium text-accent underline decoration-1 underline-offset-2 hover:decoration-2 focus-visible:focus-ring",
          className,
        )}
      >
        {t("pageLinks.choose")}
      </button>
      <PagePickerDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onChoose={(page) => {
          setIsOpen(false);
          onChoose(page);
        }}
      />
    </>
  );
}
