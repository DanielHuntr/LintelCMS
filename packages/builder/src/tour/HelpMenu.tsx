import { CircleHelp } from "lucide-react";
import { useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { IconButton } from "../ui/controls.js";

interface HelpMenuProps {
  onReplayTour: () => void;
  onShowTips: () => void;
}

/** Help and tips: replay the tour, or bring back the tips that were closed. */
export function HelpMenu({ onReplayTour, onShowTips }: HelpMenuProps) {
  const text = useBuilderText();
  const [isOpen, setIsOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const choose = (action: () => void) => {
    setIsOpen(false);
    action();
  };
  const itemClassName =
    "w-full rounded-control px-2 py-1.5 text-left text-footnote text-label hover:bg-fill focus-visible:focus-ring";

  return (
    <div className="relative" ref={wrapper}>
      <IconButton
        icon={CircleHelp}
        label={text("pageBuilder.help.button")}
        pressed={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div
          role="dialog"
          aria-label={text("pageBuilder.help.button")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setIsOpen(false);
              wrapper.current?.querySelector("button")?.focus();
            }
          }}
          className="absolute top-10 right-0 z-30 flex w-56 flex-col rounded-panel bg-surface-raised p-2 shadow-float hairline-ring"
        >
          <button type="button" className={itemClassName} onClick={() => choose(onReplayTour)}>
            {text("pageBuilder.help.replayTour")}
          </button>
          <button type="button" className={itemClassName} onClick={() => choose(onShowTips)}>
            {text("pageBuilder.help.showTips")}
          </button>
        </div>
      )}
    </div>
  );
}
