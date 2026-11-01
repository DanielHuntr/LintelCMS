import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { availableWidgets } from "../dashboard/availableWidgets.js";
import { CreateDialog } from "../content-tree/CreateDialog.js";
import { Button } from "../design/Button.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Page } from "../design/Page.js";
import { t } from "../i18n/strings.js";
import { useAdminPlugins } from "../plugins/AdminPluginsContext.js";
import { useCan, useSession } from "../session/SessionContext.js";

/** The dashboard widgets the landing shows, by full id, in this order. */
export const landingWidgetIds = [
  "core:my-edits",
  "core:needs-attention",
  "core:scheduled",
] as const;

/**
 * /content with nothing open: a calm starting point instead of a grid of cards. A Create
 * button, and the person's recent edits, drafts waiting and what is scheduled, drawn by the
 * home dashboard's own widgets (so plugins' improvements to them show here too).
 */
export function ContentLanding() {
  const session = useSession();
  const plugins = useAdminPlugins();
  const canCreate = useCan("entries:create");
  const [isCreating, setIsCreating] = useState(false);
  const widgets = useMemo(() => {
    const available = availableWidgets(plugins, session);
    return landingWidgetIds.flatMap((id) => available.filter((widget) => widget.fullId === id));
  }, [plugins, session]);

  return (
    <Page width="wide">
      <LargeTitle
        title={t("landing.title")}
        subtitle={t("landing.subtitle")}
        actions={
          canCreate ? (
            <Button icon={<Plus aria-hidden="true" />} onClick={() => setIsCreating(true)}>
              {t("landing.create")}
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 @min-[60rem]:grid-cols-2">
        {widgets.map((widget, index) => (
          <section
            key={widget.fullId}
            aria-labelledby={`landing-${widget.id}`}
            className={
              index === 0
                ? "rounded-card bg-surface px-5 pt-4 pb-2 @min-[60rem]:row-span-2"
                : "rounded-card bg-surface px-5 pt-4 pb-2"
            }
          >
            <h2
              id={`landing-${widget.id}`}
              className="mb-3 flex items-center gap-2 text-headline text-label"
            >
              <widget.icon
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 text-label-secondary"
              />
              {widget.title}
            </h2>
            <widget.component size="medium" />
          </section>
        ))}
      </div>
      {isCreating && (
        <CreateDialog place={null} placeName={undefined} onClose={() => setIsCreating(false)} />
      )}
    </Page>
  );
}
