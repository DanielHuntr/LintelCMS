import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { stepIcons } from "./stepIcons.js";
import type { StepType } from "./workflows.types.js";

interface StepCardProps {
  type: StepType | "trigger";
  /** The kind of step, small above the sentence: "Send an email". */
  kindLabel: string;
  /** What it does, in plain English. */
  description: string;
  onEdit?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** The branches under a condition or approval. */
  children?: ReactNode;
}

/** One card in the flow: icon, what kind of step, the sentence, and its actions. */
export function StepCard({
  type,
  kindLabel,
  description,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  children,
}: StepCardProps) {
  const Icon = stepIcons[type];
  return (
    <li className="flex flex-col">
      <article
        aria-label={`${kindLabel}: ${description}`}
        className={classNames(
          "flex items-start gap-3 rounded-card bg-surface p-4 shadow-float",
          type === "trigger" && "ring-1 ring-accent/30",
        )}
      >
        <span
          className={classNames(
            "flex size-8 shrink-0 items-center justify-center rounded-control",
            type === "trigger" ? "bg-accent-fill text-on-accent" : "bg-accent/12 text-accent",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption font-medium text-label-secondary">{kindLabel}</span>
          <p className="text-body break-words text-label">{description}</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {onMoveUp && (
            <IconButton label={t("steps.moveUp")} icon={<ArrowUp />} onClick={onMoveUp} />
          )}
          {onMoveDown && (
            <IconButton label={t("steps.moveDown")} icon={<ArrowDown />} onClick={onMoveDown} />
          )}
          {onEdit && (
            <IconButton
              label={`${t("steps.edit")}: ${kindLabel}`}
              icon={<Pencil />}
              onClick={onEdit}
            />
          )}
          {onRemove && (
            <IconButton
              label={`${t("steps.remove")}: ${kindLabel}`}
              icon={<Trash2 />}
              onClick={onRemove}
            />
          )}
        </div>
      </article>
      {children}
    </li>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring [&>svg]:size-3.5"
    >
      {icon}
    </button>
  );
}
