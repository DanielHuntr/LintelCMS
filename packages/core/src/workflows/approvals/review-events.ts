import type { EntryEventData } from "../../content-events/entry-event-data.js";
import type { EventDefinition } from "../../events/event-catalogue.js";

/**
 * The event content approval adds to the bus, declared the way any feature or plugin
 * declares its own: a type for the catalogue, and a definition for the admin.
 */
declare module "../../events/event-catalogue.js" {
  interface LintelEvents {
    /** An author asked for an entry to be reviewed before it is published. */
    "entry.review_requested": { entry: EntryEventData; note: string };
  }
}

export const reviewRequestedEvent: EventDefinition = {
  name: "entry.review_requested",
  label: "An entry is submitted for review",
  group: "Content",
  sampleData: {
    entry: {
      id: "00000000-0000-4000-8000-000000000001",
      collection: "pages",
      slug: "about",
      title: "About us",
      url: "/about",
      status: "draft",
      publishedAt: null,
    },
    note: "Ready for a look",
  },
};
