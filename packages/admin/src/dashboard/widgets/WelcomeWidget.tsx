import { CircleHelp, FilePlus2, ImageUp, PenSquare, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "../../design/LinkButton.js";
import { t } from "../../i18n/strings.js";
import type { WidgetProps } from "../../plugins/adminPlugin.js";
import { useCan, useSession } from "../../session/SessionContext.js";

/** "Good morning", "Good afternoon" or "Good evening", by the hour on this device. */
export function greetingFor(hour: number, name: string): string {
  if (hour < 12) return t("dashboard.welcome.morning", { name });
  if (hour < 18) return t("dashboard.welcome.afternoon", { name });
  return t("dashboard.welcome.evening", { name });
}

/** A greeting, and the few things people come to the admin to do, as buttons. */
export function WelcomeWidget({ size }: WidgetProps) {
  const session = useSession();
  const canWrite = useCan("entries:create");
  const canUpload = useCan("media:create");
  const canSeeSettings = useCan("settings:read");
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;

  const actions: Array<{ key: string; element: ReactNode }> = [];
  if (canWrite) {
    actions.push({
      key: "page",
      element: (
        <LinkButton
          to="/content/$collection/$entryId"
          params={{ collection: "pages", entryId: "new" }}
          search={{}}
          variant="filled"
          icon={<FilePlus2 aria-hidden="true" />}
        >
          {t("dashboard.welcome.newPage")}
        </LinkButton>
      ),
    });
  }
  if (canWrite && session.enabledPlugins.includes("blog")) {
    actions.push({
      key: "post",
      element: (
        <LinkButton
          to="/content/$collection/$entryId"
          params={{ collection: "posts", entryId: "new" }}
          search={{}}
          variant="tinted"
          icon={<PenSquare aria-hidden="true" />}
        >
          {t("dashboard.welcome.newPost")}
        </LinkButton>
      ),
    });
  }
  if (canUpload) {
    actions.push({
      key: "media",
      element: (
        <LinkButton to="/media" search={{}} variant="tinted" icon={<ImageUp aria-hidden="true" />}>
          {t("dashboard.welcome.uploadMedia")}
        </LinkButton>
      ),
    });
  }
  if (canSeeSettings && size === "large") {
    actions.push({
      key: "settings",
      element: (
        <LinkButton to="/settings" variant="plain" icon={<Settings aria-hidden="true" />}>
          {t("dashboard.welcome.settings")}
        </LinkButton>
      ),
    });
  }
  actions.push({
    key: "help",
    element: (
      <LinkButton to="/help" search={{}} variant="plain" icon={<CircleHelp aria-hidden="true" />}>
        {t("dashboard.welcome.help")}
      </LinkButton>
    ),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-title text-label">{greetingFor(new Date().getHours(), firstName)}</p>
        <p className="text-body text-label-secondary">{t("dashboard.welcome.prompt")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <li key={action.key}>{action.element}</li>
        ))}
      </ul>
    </div>
  );
}
