import {
  ArrowUpCircle,
  CalendarClock,
  HardDrive,
  History,
  ListTodo,
  PenLine,
  Sparkles,
} from "lucide-react";
import { UpdatesWidget } from "../../updates/UpdatesWidget.js";
import { t } from "../../i18n/strings.js";
import type { DashboardWidget } from "../../plugins/adminPlugin.js";
import { MediaUsageWidget } from "./MediaUsageWidget.js";
import { MyEditsWidget } from "./MyEditsWidget.js";
import { NeedsAttentionWidget } from "./NeedsAttentionWidget.js";
import { RecentEditsWidget } from "./RecentEditsWidget.js";
import { ScheduledWidget } from "./ScheduledWidget.js";
import { WelcomeWidget } from "./WelcomeWidget.js";

/**
 * Lintel's own widgets, in the order a new dashboard shows them. Their full ids are
 * "core:<id>". Plugins add theirs through `dashboardWidgets` (see src/plugins).
 */
export const builtInWidgets: readonly DashboardWidget[] = [
  {
    id: "welcome",
    title: t("dashboard.welcome.title"),
    description: t("dashboard.welcome.description"),
    icon: Sparkles,
    component: WelcomeWidget,
    defaultSize: "large",
    onDefaultDashboard: true,
  },
  {
    id: "recent-edits",
    title: t("dashboard.recentEdits.title"),
    description: t("dashboard.recentEdits.description"),
    icon: PenLine,
    component: RecentEditsWidget,
    defaultSize: "medium",
    permission: "entries:read",
    onDefaultDashboard: true,
  },
  {
    id: "my-edits",
    title: t("dashboard.myEdits.title"),
    description: t("dashboard.myEdits.description"),
    icon: History,
    component: MyEditsWidget,
    defaultSize: "medium",
    permission: "entries:read",
  },
  {
    id: "needs-attention",
    title: t("dashboard.attention.title"),
    description: t("dashboard.attention.description"),
    icon: ListTodo,
    component: NeedsAttentionWidget,
    defaultSize: "medium",
    permission: "entries:read",
    onDefaultDashboard: true,
  },
  {
    id: "scheduled",
    title: t("dashboard.scheduled.title"),
    description: t("dashboard.scheduled.description"),
    icon: CalendarClock,
    component: ScheduledWidget,
    defaultSize: "medium",
    permission: "entries:read",
    onDefaultDashboard: true,
  },
  {
    id: "media-usage",
    title: t("dashboard.media.title"),
    description: t("dashboard.media.description"),
    icon: HardDrive,
    component: MediaUsageWidget,
    defaultSize: "medium",
    permission: "media:read",
    onDefaultDashboard: true,
  },
  {
    id: "updates",
    title: t("dashboard.updates.title"),
    description: t("dashboard.updates.description"),
    icon: ArrowUpCircle,
    component: UpdatesWidget,
    defaultSize: "small",
    permission: "updates:read",
    onDefaultDashboard: true,
  },
];
