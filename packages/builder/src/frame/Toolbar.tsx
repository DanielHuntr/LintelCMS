import type { Breakpoint } from "@lintel/builder-model";
import { History, Monitor, Redo2, Smartphone, Tablet, Undo2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { ChoiceGroup, classNames, IconButton } from "../ui/controls.js";
import { isMac } from "../editor/shortcuts.js";
import { SkillLevelMenu } from "../skill-level/SkillLevelMenu.js";
import type { SkillLevel } from "../skill-level/skill-levels.js";
import { HelpMenu } from "../tour/HelpMenu.js";

interface ToolbarProps {
  title: string;
  start?: ReactNode;
  end?: ReactNode;
  breakpoint: Breakpoint;
  onBreakpointChange: (breakpoint: Breakpoint) => void;
  undoLabel: string | undefined;
  redoLabel: string | undefined;
  onUndo: () => void;
  onRedo: () => void;
  history: readonly string[];
  /** How many steps of `history` are done; the rest are undone and can be redone. */
  historyPosition: number;
  onGoToStep: (index: number) => void;
  canEditCode: boolean;
  skillLevel: SkillLevel;
  onSkillLevelChange: (level: SkillLevel) => void;
  onReplayTour: () => void;
  onShowTips: () => void;
}

/** Back, the page's name, screen sizes, undo and redo, history, tools, help, and the app's own actions. */
export function Toolbar(props: ToolbarProps) {
  const text = useBuilderText();
  const mod = isMac() ? "⌘" : "Ctrl+";
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 hairline-bottom bg-surface px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {props.start}
        <h1 className="truncate text-headline text-label">{props.title}</h1>
      </div>
      <div className="w-64" data-tour="screen-size">
        <ChoiceGroup<Breakpoint>
          label={text("pageBuilder.toolbar.screenSize")}
          hideLabel
          value={props.breakpoint}
          onChange={props.onBreakpointChange}
          choices={[
            { value: "base", label: text("pageBuilder.toolbar.desktop"), icon: Monitor },
            { value: "tablet", label: text("pageBuilder.toolbar.tablet"), icon: Tablet },
            { value: "phone", label: text("pageBuilder.toolbar.phone"), icon: Smartphone },
          ]}
        />
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <IconButton
          icon={Undo2}
          label={
            props.undoLabel
              ? text("pageBuilder.toolbar.undoThing", { name: props.undoLabel })
              : text("pageBuilder.toolbar.undo")
          }
          hint={`${text("pageBuilder.toolbar.undo")} (${mod}Z)`}
          disabled={!props.undoLabel}
          onClick={props.onUndo}
        />
        <IconButton
          icon={Redo2}
          label={
            props.redoLabel
              ? text("pageBuilder.toolbar.redoThing", { name: props.redoLabel })
              : text("pageBuilder.toolbar.redo")
          }
          hint={`${text("pageBuilder.toolbar.redo")} (${isMac() ? "⇧⌘Z" : "Ctrl+Y"})`}
          disabled={!props.redoLabel}
          onClick={props.onRedo}
        />
        <HistoryMenu
          history={props.history}
          position={props.historyPosition}
          onGoToStep={props.onGoToStep}
        />
        <SkillLevelMenu
          level={props.skillLevel}
          canEditCode={props.canEditCode}
          onChange={props.onSkillLevelChange}
        />
        <HelpMenu onReplayTour={props.onReplayTour} onShowTips={props.onShowTips} />
        {props.end}
      </div>
    </header>
  );
}

/** Every change made in this session; pick one to go back (or forward) to just after it. */
function HistoryMenu({
  history,
  position,
  onGoToStep,
}: {
  history: readonly string[];
  position: number;
  onGoToStep: (index: number) => void;
}) {
  const text = useBuilderText();
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  return (
    <div className="relative" data-tour="history">
      <IconButton
        icon={History}
        label={text("pageBuilder.history.title")}
        pressed={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div
          id={listId}
          role="dialog"
          aria-label={text("pageBuilder.history.title")}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsOpen(false);
          }}
          className="absolute top-10 inset-e-0 z-30 w-72 rounded-panel bg-surface-raised p-2 shadow-float hairline-ring"
        >
          <h2 className="px-2 py-1 text-footnote font-semibold text-label">
            {text("pageBuilder.history.title")}
          </h2>
          <ol className="max-h-80 overflow-auto">
            <li>
              <HistoryStepButton
                label={text("pageBuilder.history.start")}
                isCurrent={position === 0}
                isUndone={false}
                onClick={() => onGoToStep(-1)}
              />
            </li>
            {history.map((label, index) => (
              <li key={index}>
                <HistoryStepButton
                  label={label}
                  isCurrent={index === position - 1}
                  isUndone={index >= position}
                  onClick={() => onGoToStep(index)}
                />
              </li>
            ))}
          </ol>
          {history.length === 0 && (
            <p className="px-2 py-2 text-caption text-label-secondary">
              {text("pageBuilder.history.empty")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryStepButton({
  label,
  isCurrent,
  isUndone,
  onClick,
}: {
  label: string;
  isCurrent: boolean;
  isUndone: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={isCurrent ? "step" : undefined}
      onClick={onClick}
      className={classNames(
        "w-full truncate rounded-control px-2 py-1.5 text-start text-footnote focus-visible:focus-ring",
        isCurrent ? "bg-accent-fill text-on-accent" : "hover:bg-fill",
        isUndone && !isCurrent && "text-label-tertiary",
      )}
    >
      {label}
    </button>
  );
}
