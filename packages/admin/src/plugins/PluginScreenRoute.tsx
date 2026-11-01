import { useLocation } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { t } from "../i18n/strings.js";
import { useVisibleContributions } from "./AdminPluginsContext.js";
import { matchScreenPath } from "./matchScreenPath.js";

/**
 * Every address the admin's own routes don't know comes here (see router.tsx). It shows the
 * plugin screen for the address, if a switched-on plugin has one the person may use, and
 * otherwise says the page isn't here. Plugin screens are added while the admin runs, so
 * they can't be in the router's own typed list.
 */
export function PluginScreenRoute() {
  const { pathname } = useLocation();
  const screens = useVisibleContributions("screens");

  // "/bookings/settings" wins over "/bookings/$bookingId", whatever order they are listed in.
  const mostSpecificFirst = [...screens].sort(
    (first, second) => countParams(first.path) - countParams(second.path),
  );
  for (const screen of mostSpecificFirst) {
    const params = matchScreenPath(screen.path, pathname);
    if (params) {
      const Screen = screen.component;
      return <Screen key={pathname} params={params} />;
    }
  }
  return <PageNotFound />;
}

function countParams(path: string): number {
  return path.split("/").filter((part) => part.startsWith("$")).length;
}

function PageNotFound() {
  return (
    <>
      <LargeTitle title={t("plugins.notFoundTitle")} />
      <Card>
        <EmptyState
          size="page"
          icon={Compass}
          title={t("plugins.notFoundHeading")}
          description={t("plugins.notFoundDescription")}
          action={
            <LinkButton to="/" variant="tinted">
              {t("plugins.backToDashboard")}
            </LinkButton>
          }
        />
      </Card>
    </>
  );
}
