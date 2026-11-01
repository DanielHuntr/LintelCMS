import { Plus } from "lucide-react";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import type { AvailableWidget } from "./availableWidgets.js";

interface WidgetGalleryProps {
  open: boolean;
  /** The widgets that aren't on the dashboard yet. */
  widgets: readonly AvailableWidget[];
  onAdd: (widget: AvailableWidget) => void;
  onClose: () => void;
}

/** "Add a widget": every widget not yet on the dashboard, with what it shows. */
export function WidgetGallery({ open, widgets, onAdd, onClose }: WidgetGalleryProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dashboard.gallery.title")}
      description={t("dashboard.gallery.description")}
      footer={
        <Button variant="plain" onClick={onClose}>
          {t("dashboard.gallery.close")}
        </Button>
      }
    >
      {widgets.length === 0 ? (
        <p className="text-body text-label-secondary">{t("dashboard.gallery.allAdded")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {widgets.map((widget, index) => (
            <li key={widget.fullId} className="flex items-center gap-3 rounded-card bg-fill/50 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent/12 text-accent">
                <widget.icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium text-label">{widget.title}</span>
                <span className="block text-footnote text-label-secondary">
                  {widget.description}
                </span>
              </span>
              <Button
                variant="tinted"
                size="small"
                aria-label={t("dashboard.gallery.addNamed", { title: widget.title })}
                icon={<Plus aria-hidden="true" />}
                onClick={() => onAdd(widget)}
                data-autofocus={index === 0 ? true : undefined}
              >
                {t("dashboard.gallery.add")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
