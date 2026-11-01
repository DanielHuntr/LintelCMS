import { Button } from "../blocks/Button.js";
import { Container } from "../layout/Container.js";
import type { SiteLabels } from "../site.types.js";
import type { EmptySiteView, NotFoundView } from "./view.types.js";

export interface MessageLayoutProps {
  view: NotFoundView | EmptySiteView;
  labels: SiteLabels;
  homeUrl: string;
}

/** "We couldn't find that page", or the welcome a brand new site shows. */
export function MessageLayout({ view, labels, homeUrl }: MessageLayoutProps) {
  const isEmptySite = view.kind === "emptySite";
  return (
    <Container width="narrow">
      <div
        className="lintel-message"
        data-lintel-component={isEmptySite ? "empty_site" : "not_found"}
      >
        <h1 className="lintel-message__title">
          {isEmptySite ? labels.emptySiteTitle : labels.notFoundTitle}
        </h1>
        <p className="lintel-message__text">
          {isEmptySite ? labels.emptySiteText : labels.notFoundText}
        </p>
        {!isEmptySite && <Button link={{ label: labels.backHome, url: homeUrl }} />}
      </div>
    </Container>
  );
}
