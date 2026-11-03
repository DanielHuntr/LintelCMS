/**
 * What the app keeps: the last things published and unpublished, from Lintel's webhooks.
 * In memory, to keep the example short; a real app would use its own database.
 */
export interface LoggedEvent {
  event: string;
  entryId: string | null;
  title: string;
  at: string;
}

const KEPT_EVENTS = 50;

export class PublishingLog {
  private readonly events: LoggedEvent[] = [];

  /** Records a webhook body like `{ event, occurredAt, data: { entry: { id, title } } }`. */
  record(payload: unknown): void {
    const body = payload as {
      event?: unknown;
      occurredAt?: unknown;
      data?: { entry?: { id?: unknown; title?: unknown; slug?: unknown } };
    };
    const entry = body.data?.entry;
    this.events.unshift({
      event: String(body.event ?? "unknown"),
      entryId: typeof entry?.id === "string" ? entry.id : null,
      title: String(entry?.title ?? entry?.slug ?? "Untitled"),
      at: typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
    });
    this.events.length = Math.min(this.events.length, KEPT_EVENTS);
  }

  /** Newest first; only one entry's when an id is given. */
  recent(entryId?: string): LoggedEvent[] {
    return entryId ? this.events.filter((event) => event.entryId === entryId) : [...this.events];
  }
}
