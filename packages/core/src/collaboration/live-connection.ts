import {
  type LiveClientMessage,
  liveClientMessageSchema,
  liveCloseCodes,
  type LivePerson,
  type LiveServerMessage,
} from "@lintel/builder-model";
import type { SignedIn } from "../auth/auth.schema.js";
import { liveLimits } from "./live-limits.js";
import { MessageBudget } from "./message-budget.js";

/** The part of a WebSocket a connection uses. */
export interface LiveSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  ping(): void;
  terminate(): void;
  readonly readyState: number;
  on(event: "message", listener: (data: Buffer | ArrayBuffer | Buffer[]) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  on(event: "pong", listener: () => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

const OPEN = 1;

/** One tab of a browser. A browser's tabs share its connection. */
export interface LiveTab {
  id: string;
  connection: LiveConnection;
  /** The pages it is on, by entry id. */
  pages: Set<string>;
  /** The site it is watching, for the content tree. */
  watchedSiteId: string | null;
}

interface ConnectionHandlers {
  /** Reads who the session belongs to now: undefined when it has ended. */
  findSignedIn: () => Promise<SignedIn | undefined>;
  onMessage: (tab: LiveTab, message: LiveClientMessage) => Promise<void>;
  /** After a fresh look at someone's permissions, to take them off what they lost. */
  onPermissionsRead: (connection: LiveConnection) => void;
  onTabClosed: (tab: LiveTab) => void;
  onClosed: (connection: LiveConnection) => void;
  onError: (error: unknown) => void;
}

/**
 * One browser's connection: reads its messages in the order they came, one at a time, and
 * holds them to the limits. Every message is checked against what the person may do now, so
 * signing out, losing a role or being removed takes effect without reconnecting.
 */
export class LiveConnection {
  readonly tabs = new Map<string, LiveTab>();
  private readonly budget = new MessageBudget();
  private strikes = 0;
  private isAlive = true;
  private isClosed = false;
  private permissionsReadAt = Date.now();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly socket: LiveSocket,
    public person: LivePerson,
    public signedIn: SignedIn,
    private readonly handlers: ConnectionHandlers,
  ) {
    socket.on("message", (data) => this.receive(data));
    socket.on("pong", () => {
      this.isAlive = true;
    });
    socket.on("error", (error) => handlers.onError(error));
    socket.on("close", () => {
      this.isClosed = true;
      for (const tab of this.tabs.values()) handlers.onTabClosed(tab);
      this.tabs.clear();
      handlers.onClosed(this);
    });
    this.send({ type: "welcome", tab: "*", personId: person.id });
  }

  send(message: LiveServerMessage): void {
    if (this.socket.readyState === OPEN) this.socket.send(JSON.stringify(message));
  }

  close(code: number, reason: string): void {
    this.socket.close(code, reason);
  }

  /** Pings the browser, and drops a connection that stopped answering the last ping. */
  sweep(): void {
    if (!this.isAlive) {
      this.socket.terminate();
      return;
    }
    this.isAlive = false;
    this.socket.ping();
    this.enqueue(async () => {
      await this.refreshPermissions(true);
    });
  }

  private receive(data: Buffer | ArrayBuffer | Buffer[]): void {
    const text = readText(data);
    if (!this.budget.spend(text.length)) {
      this.strike("SLOW_DOWN");
      return;
    }
    this.enqueue(() => this.handle(text));
  }

  private enqueue(work: () => Promise<void>): void {
    this.queue = this.queue.then(work).catch((error: unknown) => this.handlers.onError(error));
  }

  private async handle(text: string): Promise<void> {
    if (this.isClosed) return;
    const message = parseMessage(text);
    if (!message) {
      this.strike("BAD_MESSAGE");
      return;
    }
    if (!(await this.refreshPermissions(false))) return;
    const tab = this.tabFor(message.tab);
    if (!tab) return;
    if (message.type === "closeTab") {
      this.handlers.onTabClosed(tab);
      this.tabs.delete(tab.id);
      return;
    }
    await this.handlers.onMessage(tab, message);
    // It may have closed while that was waiting for the database: this tab can't stay behind.
    if (this.isClosed) this.handlers.onTabClosed(tab);
  }

  private tabFor(id: string): LiveTab | undefined {
    const known = this.tabs.get(id);
    if (known) return known;
    if (this.tabs.size >= liveLimits.maxTabsPerConnection) {
      this.strike("SLOW_DOWN");
      return undefined;
    }
    const tab: LiveTab = { id, connection: this, pages: new Set(), watchedSiteId: null };
    this.tabs.set(id, tab);
    return tab;
  }

  /** Reads the person's session and permissions again once what we hold has gone stale. */
  private async refreshPermissions(evenIfFresh: boolean): Promise<boolean> {
    const age = Date.now() - this.permissionsReadAt;
    if (!evenIfFresh && age < liveLimits.permissionsFreshForMilliseconds) return true;
    const signedIn = await this.handlers.findSignedIn();
    if (!signedIn || signedIn.mustSetUpTwoFactor) {
      this.close(liveCloseCodes.signedOut, "Signed out");
      return false;
    }
    this.signedIn = signedIn;
    this.permissionsReadAt = Date.now();
    this.person = { ...this.person, name: signedIn.user.name };
    this.handlers.onPermissionsRead(this);
    return true;
  }

  private strike(code: "SLOW_DOWN" | "BAD_MESSAGE"): void {
    this.strikes += 1;
    if (this.strikes >= liveLimits.strikesBeforeClosing) {
      this.close(liveCloseCodes.tooManyMessages, "Too many messages");
      return;
    }
    this.send({ type: "refused", tab: "*", code, message: "That message wasn't accepted." });
  }
}

function readText(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}

function parseMessage(text: string): LiveClientMessage | null {
  try {
    const parsed = liveClientMessageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
