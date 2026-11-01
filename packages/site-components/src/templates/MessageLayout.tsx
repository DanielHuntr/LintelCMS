import { Button } from "../blocks/Button.js";
import { Container } from "../layout/Container.js";
import type { SiteLabels } from "../site.types.js";
import type { EmptySiteView, MessageView, NotFoundView } from "./view.types.js";

export interface MessageLayoutProps {
  view: NotFoundView | EmptySiteView | MessageView;
  labels: SiteLabels;
  homeUrl: string;
}

const componentNames = { notFound: "not_found", emptySite: "empty_site", message: "message" };

/** "We couldn't find that page", the welcome a brand new site shows, or another message. */
export function MessageLayout({ view, labels, homeUrl }: MessageLayoutProps) {
  const { title, text } = messageText(view, labels);
  return (
    <Container width="narrow">
      <div className="lintel-message" data-lintel-component={componentNames[view.kind]}>
        <h1 className="lintel-message__title">{title}</h1>
        <p className="lintel-message__text">{text}</p>
        {view.kind !== "emptySite" && <Button link={{ label: labels.backHome, url: homeUrl }} />}
      </div>
    </Container>
  );
}

function messageText(view: MessageLayoutProps["view"], labels: SiteLabels) {
  switch (view.kind) {
    case "notFound":
      return { title: labels.notFoundTitle, text: labels.notFoundText };
    case "emptySite":
      return { title: labels.emptySiteTitle, text: labels.emptySiteText };
    case "message":
      return { title: view.title, text: view.text };
  }
}
