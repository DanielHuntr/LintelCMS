import type { AssetEventData, EntryEventData } from "../content-events/entry-event-data.js";

/** The person whose action caused an event. Null for the scheduler and for automations. */
export interface EventActor {
  id: string;
  name: string;
  email: string;
}

/**
 * Every event in Lintel and what it carries, keyed by name ("<thing>.<what happened>").
 *
 * Features and plugins add their own events by extending this interface, so publishing
 * and subscribing stay type-checked, and by declaring them on the bus (see
 * `EventBus.declare`) so the admin can offer them:
 *
 *   declare module "../events/event-catalogue.js" {
 *     interface LintelEvents {
 *       "order.placed": { order: { id: string; total: number } };
 *     }
 *   }
 */
export interface LintelEvents {
  "entry.created": { entry: EntryEventData };
  /** `changedFields` are the handles whose saved values changed, plus "slug" and "parent". */
  "entry.updated": { entry: EntryEventData; changedFields: string[] };
  "entry.published": { entry: EntryEventData };
  "entry.unpublished": { entry: EntryEventData };
  "entry.deleted": { entry: EntryEventData };
  /** A live entry's address changed, because its slug or parent changed. */
  "entry.moved": { entry: EntryEventData; previousUrl: string };
  "asset.uploaded": { asset: AssetEventData };
  "asset.deleted": { asset: AssetEventData };
  /** Declared now so automations can use it; the forms feature publishes it. */
  "form.submitted": {
    form: { id: string; handle: string; name: string };
    submission: { id: string; fields: Record<string, unknown> };
  };
  /** Declared now so automations can use it; the users feature publishes it. */
  "user.invited": {
    user: { id: string; name: string; email: string };
    roles: string[];
  };
}

export type LintelEventName = keyof LintelEvents & string;

/**
 * Questions features ask before doing something, which other features may answer "no" to
 * by throwing an HttpError. Extended the same way as LintelEvents.
 */
export interface LintelChecks {
  /** Asked before an entry is published or scheduled by a person. */
  "entry.publishing": { entry: EntryEventData; actor: EventActor; permissions: string[] };
}

export type LintelCheckName = keyof LintelChecks & string;

/**
 * What the admin shows about an event: its name, a plain label, and example data for
 * trying an automation out. `group` sorts them ("Content", "Media", "Forms").
 */
export interface EventDefinition {
  name: string;
  label: string;
  group: string;
  sampleData: Record<string, unknown>;
}

const sampleEntry: EntryEventData = {
  id: "00000000-0000-4000-8000-000000000001",
  collection: "posts",
  slug: "hello-world",
  title: "Hello world",
  url: "/blog/hello-world",
  status: "published",
  publishedAt: "2026-11-01T09:00:00.000Z",
};

const sampleAsset: AssetEventData = {
  id: "00000000-0000-4000-8000-000000000002",
  filename: "team-photo.jpg",
  mimeType: "image/jpeg",
  url: "/media/team-photo.jpg",
};

/** The events core itself knows about, in the order the admin lists them. */
export const coreEventDefinitions: EventDefinition[] = [
  {
    name: "entry.created",
    label: "An entry is created",
    group: "Content",
    sampleData: { entry: { ...sampleEntry, status: "draft", publishedAt: null } },
  },
  {
    name: "entry.updated",
    label: "An entry is changed",
    group: "Content",
    sampleData: { entry: { ...sampleEntry, status: "draft" }, changedFields: ["title"] },
  },
  {
    name: "entry.published",
    label: "An entry is published",
    group: "Content",
    sampleData: { entry: sampleEntry },
  },
  {
    name: "entry.unpublished",
    label: "An entry is unpublished",
    group: "Content",
    sampleData: { entry: { ...sampleEntry, status: "draft", publishedAt: null } },
  },
  {
    name: "entry.deleted",
    label: "An entry is deleted",
    group: "Content",
    sampleData: { entry: sampleEntry },
  },
  {
    name: "asset.uploaded",
    label: "A file is uploaded",
    group: "Media",
    sampleData: { asset: sampleAsset },
  },
  {
    name: "asset.deleted",
    label: "A file is deleted",
    group: "Media",
    sampleData: { asset: sampleAsset },
  },
  {
    name: "form.submitted",
    label: "A form is submitted",
    group: "Forms",
    sampleData: {
      form: { id: "00000000-0000-4000-8000-000000000003", handle: "contact", name: "Contact" },
      submission: {
        id: "00000000-0000-4000-8000-000000000004",
        fields: { name: "Sam Rivera", email: "sam@example.com", message: "Hello there" },
      },
    },
  },
  {
    name: "user.invited",
    label: "Someone is invited",
    group: "People",
    sampleData: {
      user: {
        id: "00000000-0000-4000-8000-000000000005",
        name: "Sam Rivera",
        email: "sam@example.com",
      },
      roles: ["editor"],
    },
  },
];
