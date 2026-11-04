import type {
  LiveAttendee,
  LiveClientMessage,
  LivePerson,
  LiveServerMessage,
} from "@lintel/builder-model";
import type { LiveLink } from "./liveSocket.js";

export type LiveStatus = "connecting" | "online" | "offline" | "unavailable" | "signedOut";

/** A message from this tab: the tab's id is added when it is sent. */
export type OutgoingMessage = LiveClientMessage extends infer Message
  ? Message extends LiveClientMessage
    ? Omit<Message, "tab">
    : never
  : never;

type OpenLink = (events: {
  onUp: () => void;
  onDown: (status: "offline" | "unavailable" | "signedOut") => void;
  onMessage: (text: string) => void;
}) => LiveLink;

const nothing: readonly LiveAttendee[] = [];
const nobody: Readonly<Record<string, LivePerson[]>> = {};

/**
 * This tab's end of the live connection. What a screen wants for as long as it is open (being
 * on a page, watching the tree) is kept here and said again each time the connection comes
 * back, so screens never think about reconnecting.
 */
export class LiveClient {
  readonly tab: string;
  status: LiveStatus = "connecting";
  personId: string | null = null;
  /** Who is on the pages of the watched site, by entry id. */
  peopleOnPages: Readonly<Record<string, LivePerson[]>> = nobody;
  private peopleHere = new Map<string, readonly LiveAttendee[]>();
  private readonly kept = new Map<string, OutgoingMessage>();
  private readonly listeners = new Set<(message: LiveServerMessage) => void>();
  private readonly changeListeners = new Set<() => void>();
  private readonly link: LiveLink;

  constructor(openLink: OpenLink, tab: string = crypto.randomUUID()) {
    this.tab = tab;
    this.link = openLink({
      onUp: () => this.handleUp(),
      onDown: (status) => this.handleDown(status),
      onMessage: (text) => this.handleMessage(text),
    });
  }

  /** The message that keeps the connection awake. */
  pingMessage(): string {
    return JSON.stringify({ type: "ping", tab: this.tab });
  }

  send(message: OutgoingMessage): void {
    if (this.status === "online") this.link.send(JSON.stringify({ ...message, tab: this.tab }));
  }

  /** Says this now and each time the connection comes back, until `forget`. */
  keep(key: string, message: OutgoingMessage): void {
    this.kept.set(key, message);
    this.send(message);
  }

  forget(key: string, goodbye?: OutgoingMessage): void {
    this.kept.delete(key);
    if (goodbye) this.send(goodbye);
  }

  listen(listener: (message: LiveServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** For `useSyncExternalStore`: told when the status or who is where changes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  };

  peopleOn(entryId: string): readonly LiveAttendee[] {
    return this.peopleHere.get(entryId) ?? nothing;
  }

  close(): void {
    this.send({ type: "closeTab" });
    this.link.close();
    this.setStatus("offline");
  }

  private handleUp(): void {
    this.setStatus("online");
    for (const message of this.kept.values()) this.send(message);
  }

  private handleDown(status: "offline" | "unavailable" | "signedOut"): void {
    // Nobody can be vouched for without a connection.
    this.peopleHere = new Map();
    this.peopleOnPages = nobody;
    this.setStatus(status);
  }

  private setStatus(status: LiveStatus): void {
    this.status = status;
    this.changed();
  }

  private changed(): void {
    for (const listener of this.changeListeners) listener();
  }

  private handleMessage(text: string): void {
    const message = JSON.parse(text) as LiveServerMessage;
    if (message.tab !== this.tab && message.tab !== "*") return;
    if (message.type === "welcome") {
      this.personId = message.personId;
      this.changed();
    } else if (message.type === "peopleHere") {
      this.peopleHere = new Map(this.peopleHere).set(message.entryId, message.people);
      this.changed();
    } else if (message.type === "peopleOnPages") {
      this.peopleOnPages = message.pages;
      this.changed();
    }
    for (const listener of this.listeners) listener(message);
  }
}
