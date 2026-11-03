import type { DraftPlan } from "@lintel/builder-model";
import { PenLine } from "lucide-react";
import { useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { classNames } from "../ui/classNames.js";
import { DraftPageDialog } from "./DraftPageDialog.js";
import { usePageDrafting } from "./page-drafting.js";

interface DraftPageButtonProps {
  /** A small link on the empty page; a full-width row at the top of Insert. */
  look: "link" | "row";
  onDrafted: (plan: DraftPlan) => void;
  /** Something to say aloud, such as "Drafting stopped". */
  onMessage: (message: string) => void;
}

/** "Draft a page for me", and its dialog. Nothing shows without page drafting. */
export function DraftPageButton({ look, onDrafted, onMessage }: DraftPageButtonProps) {
  const text = useBuilderText();
  const drafting = usePageDrafting();
  const button = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);
  if (!drafting) return null;
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={classNames(
          "flex items-center gap-1.5 rounded-control text-footnote font-medium text-accent focus-visible:focus-ring",
          look === "link"
            ? "px-2 py-1 hover:underline"
            : "h-8 w-full bg-fill px-2.5 hover:bg-fill-strong",
        )}
      >
        <PenLine aria-hidden="true" className="size-3.5" />
        {text("pageBuilder.draft.open")}
      </button>
      {isOpen && (
        <DraftPageDialog
          drafting={drafting}
          returnFocusTo={button}
          onDrafted={(plan) => {
            setOpen(false);
            onDrafted(plan);
          }}
          onClose={(message) => {
            setOpen(false);
            if (message) onMessage(message);
          }}
        />
      )}
    </>
  );
}
