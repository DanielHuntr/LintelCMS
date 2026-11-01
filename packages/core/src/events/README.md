# Events

Lintel's internal event bus. A feature publishes what happened after the change is saved;
other features subscribe without the publisher knowing about them. `buildServer` makes one
bus, `server.events`.

```ts
await server.events.publish("entry.published", { entry }, { actor });
server.events.on("entry.moved", "seo redirect suggestions", async (event) => { ... });
server.events.onEvery("automations", async (event) => { ... });
```

- Events are typed. `event-catalogue.ts` lists them in `LintelEvents`: entry created,
  updated, published, unpublished, deleted and moved; asset uploaded and deleted; form
  submitted and user invited (declared for the forms and users features to publish).
- Every event has an `id`, `occurredAt`, the `actor` (who did it, or null for the
  scheduler and automations) and a `cause` when an automation caused it, which stops
  automations from setting each other off forever.
- Listeners run in order and `publish` waits for them. A listener failing is logged and
  the others are still told: the change has already been saved. Slow work (sending
  webhooks, running workflows) is written down and done in the background.
- **Checks** go the other way: before acting, a feature asks (`runChecks`) and any
  feature may refuse by throwing an HttpError. Entries ask `"entry.publishing"`, which
  content approval answers.

## Declaring your own events

A feature or plugin extends the catalogue's types and declares the event so the admin can
offer it in Automations, with a label and sample data for test runs:

```ts
declare module "../events/event-catalogue.js" {
  interface LintelEvents {
    "order.placed": { order: { id: string; total: number } };
  }
}

server.events.declare({
  name: "order.placed",
  label: "An order is placed",
  group: "Shop",
  sampleData: { order: { id: "1001", total: 42 } },
});
```

`src/workflows/approvals/review-events.ts` does exactly this for `entry.review_requested`.

## Who listens

`event-listeners.ts` is the visible list: webhooks, SEO redirect suggestions, and
automations (which subscribe in `registerWorkflows`).

| File                 | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `event-bus.ts`       | Publishing, subscribing, declaring and checks         |
| `event-catalogue.ts` | The events, the checks, and core's labels and samples |
| `event-listeners.ts` | Who listens to what                                   |
| `event-actor.ts`     | The signed-in person, as events name them             |
