import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { LayoutGrid, Pencil, Plus, RotateCcw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { Page } from "../design/Page.js";
import { useAdminPlugins } from "../plugins/AdminPluginsContext.js";
import type { WidgetSize } from "../plugins/adminPlugin.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { type AvailableWidget, availableWidgets } from "./availableWidgets.js";
import {
  addWidget,
  columnSpans,
  defaultLayout,
  moveWidget,
  removeWidget,
  resizeWidget,
  sizeColumnCount,
  splitLayout,
  type WidgetPlacement,
} from "./dashboardLayout.js";
import {
  useDashboardLayout,
  useResetDashboardLayout,
  useSaveDashboardLayout,
} from "./dashboard.queries.js";
import { RoleDefaultDialog } from "./RoleDefaultDialog.js";
import { WidgetFrame } from "./WidgetFrame.js";
import { WidgetGallery } from "./WidgetGallery.js";

type OpenDialog = "gallery" | "reset" | "roleDefault" | null;

/**
 * The home screen: the person's widgets, in their order and sizes. "Edit dashboard" lets
 * them add widgets from a gallery, remove, move (drag, or the arrow buttons) and resize
 * them; Done saves the layout to their account. Admins can also make it a role's default.
 */
export function DashboardPage() {
  const session = useSession();
  const plugins = useAdminPlugins();
  const canSetRoleDefaults = useCan("settings:update");
  const available = useMemo(() => availableWidgets(plugins, session), [plugins, session]);
  const stored = useDashboardLayout();
  const save = useSaveDashboardLayout();
  const reset = useResetDashboardLayout();
  const [draft, setDraft] = useState<WidgetPlacement[] | null>(null);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const saved = stored.data?.widgets ?? defaultLayout(available);
  const { visible, hidden } = splitLayout(saved, available);
  const isEditing = draft !== null;
  const layout = draft ?? visible;
  const byId = new Map(available.map((widget) => [widget.fullId, widget]));
  const titleOf = (widgetId: string) => byId.get(widgetId)?.title ?? widgetId;
  const spans = columnSpans(layout.map((placement) => placement.size));

  function change(next: WidgetPlacement[], message: string) {
    setDraft(next);
    setAnnouncement(message);
  }

  function move(widgetId: string, toIndex: number) {
    const next = moveWidget(layout, widgetId, toIndex);
    const position = next.findIndex((placement) => placement.widget === widgetId) + 1;
    change(next, t("dashboard.moved", { title: titleOf(widgetId), position, count: next.length }));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(
      String(active.id),
      layout.findIndex((placement) => placement.widget === over.id),
    );
  }

  function finishEditing() {
    if (!draft) return;
    // Widgets hidden right now (a plugin switched off) keep their place at the end.
    save.mutate([...draft, ...hidden], {
      onSuccess: () => {
        setDraft(null);
        setAnnouncement(t("dashboard.saved"));
      },
    });
  }

  function resetToDefault() {
    reset.mutate(undefined, {
      onSuccess: () => {
        setDraft(null);
        setOpenDialog(null);
        setAnnouncement(t("dashboard.resetDone"));
      },
    });
  }

  const notPlaced = available.filter(
    (widget) => !layout.some((placement) => placement.widget === widget.fullId),
  );

  return (
    <Page width="wide">
      <LargeTitle
        title={t("dashboard.title")}
        subtitle={t(isEditing ? "dashboard.editSubtitle" : "dashboard.subtitle")}
        actions={
          isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="plain" onClick={() => setDraft(null)} disabled={save.isPending}>
                {t("dashboard.cancel")}
              </Button>
              <Button onClick={finishEditing} disabled={save.isPending}>
                {save.isPending ? t("dashboard.saving") : t("dashboard.done")}
              </Button>
            </div>
          ) : (
            <Button
              variant="tinted"
              icon={<Pencil aria-hidden="true" />}
              onClick={() => setDraft(visible)}
              disabled={!stored.data}
            >
              {t("dashboard.edit")}
            </Button>
          )
        }
      />

      {isEditing && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Button
            variant="tinted"
            size="small"
            icon={<Plus aria-hidden="true" />}
            onClick={() => setOpenDialog("gallery")}
          >
            {t("dashboard.addWidget")}
          </Button>
          <Button
            variant="plain"
            size="small"
            icon={<RotateCcw aria-hidden="true" />}
            onClick={() => setOpenDialog("reset")}
          >
            {t("dashboard.reset")}
          </Button>
          {canSetRoleDefaults && (
            <Button
              variant="plain"
              size="small"
              icon={<Users aria-hidden="true" />}
              onClick={() => setOpenDialog("roleDefault")}
            >
              {t("dashboard.roleDefault.open")}
            </Button>
          )}
        </div>
      )}

      {stored.isError && <LoadError error={stored.error} onRetry={() => void stored.refetch()} />}
      {stored.isPending && (
        <LoadingRegion label={t("dashboard.loading")}>
          <div className="grid grid-cols-2 gap-5">
            {[0, 1, 2, 3].map((card) => (
              <Skeleton key={card} className="h-40 rounded-card" />
            ))}
          </div>
        </LoadingRegion>
      )}
      {(save.error ?? reset.error) && (
        <p role="alert" className="mb-4 text-footnote text-danger">
          {describeError(save.error ?? reset.error)}
        </p>
      )}

      {stored.data && layout.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={LayoutGrid}
            title={t("dashboard.empty.title")}
            description={t("dashboard.empty.description")}
            action={
              <Button
                variant="tinted"
                icon={<Plus aria-hidden="true" />}
                onClick={() => {
                  if (!isEditing) setDraft(visible);
                  setOpenDialog("gallery");
                }}
              >
                {t("dashboard.addWidget")}
              </Button>
            }
          />
        </div>
      )}

      {stored.data && layout.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={layout.map((placement) => placement.widget)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-6 gap-5">
              {layout.map((placement, index) => {
                const widget = byId.get(placement.widget);
                if (!widget) return null;
                return (
                  <PlacedWidget
                    key={placement.widget}
                    widget={widget}
                    size={placement.size}
                    // Edit mode shows each widget at its own size, so the size control matches.
                    columns={isEditing ? sizeColumnCount[placement.size] : (spans[index] ?? 6)}
                    position={index + 1}
                    count={layout.length}
                    isEditing={isEditing}
                    onMove={(offset) => move(placement.widget, index + offset)}
                    onResize={(size) =>
                      change(
                        resizeWidget(layout, placement.widget, size),
                        t("dashboard.resized", {
                          title: widget.title,
                          size: t(`dashboard.size.${size}`).toLowerCase(),
                        }),
                      )
                    }
                    onRemove={() =>
                      change(
                        removeWidget(layout, placement.widget),
                        t("dashboard.removed", { title: widget.title }),
                      )
                    }
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <WidgetGallery
        open={openDialog === "gallery"}
        widgets={notPlaced}
        onClose={() => setOpenDialog(null)}
        onAdd={(widget) => {
          change(addWidget(layout, widget), t("dashboard.added", { title: widget.title }));
          setOpenDialog(null);
        }}
      />
      <ConfirmDialog
        open={openDialog === "reset"}
        title={t("dashboard.resetTitle")}
        message={t("dashboard.resetDescription")}
        confirmLabel={t("dashboard.resetConfirm")}
        cancelLabel={t("dashboard.cancel")}
        isWorking={reset.isPending}
        onConfirm={resetToDefault}
        onCancel={() => setOpenDialog(null)}
      />
      {canSetRoleDefaults && (
        <RoleDefaultDialog
          open={openDialog === "roleDefault"}
          layout={layout}
          onClose={() => setOpenDialog(null)}
        />
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </Page>
  );
}

interface PlacedWidgetProps {
  widget: AvailableWidget;
  size: WidgetSize;
  columns: number;
  position: number;
  count: number;
  isEditing: boolean;
  onMove: (offset: -1 | 1) => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}

function PlacedWidget({ widget, size, ...frame }: PlacedWidgetProps) {
  const Widget = widget.component;
  return (
    <WidgetFrame widgetId={widget.fullId} title={widget.title} size={size} {...frame}>
      <Widget size={size} />
    </WidgetFrame>
  );
}
