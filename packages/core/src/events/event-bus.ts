import { randomUUID } from "node:crypto";
import {
  coreEventDefinitions,
  type EventActor,
  type EventDefinition,
  type LintelCheckName,
  type LintelChecks,
  type LintelEventName,
  type LintelEvents,
} from "./event-catalogue.js";

/**
 * One thing that happened, as listeners receive it. `id` is unique per event, so a
 * listener that is told twice (a retry, a second server) can tell.
 */
export interface PublishedEvent<Name extends LintelEventName = LintelEventName> {
  id: string;
  name: Name;
  occurredAt: string;
  data: LintelEvents[Name];
  actor: EventActor | null;
  /**
   * Set when an automation caused the event, so automations can't set each other off
   * forever: each run started by an event is one level deeper (see src/workflows).
   */
  cause: EventCause | null;
  /** Sent by a script rather than a person, as far as the request shows. */
  fromRobot?: boolean;
}

export interface EventCause {
  workflowRunId: string;
  depth: number;
}

/** Any one event, narrowed by checking `event.name`. */
export type AnyPublishedEvent = {
  [Name in LintelEventName]: PublishedEvent<Name>;
}[LintelEventName];

export interface PublishOptions {
  actor?: EventActor | null;
  cause?: EventCause | null;
  fromRobot?: boolean;
  /** Tests pass a fixed time. */
  now?: Date;
}

type Listener<Event> = (event: Event) => Promise<void> | void;
type Check<Name extends LintelCheckName> = (question: LintelChecks[Name]) => Promise<void> | void;

interface Subscription {
  /** Undefined means every event. */
  eventName: LintelEventName | undefined;
  listenerName: string;
  listener: Listener<AnyPublishedEvent>;
}

export interface EventBusOptions {
  /** A listener failing is reported here; the others are still told. */
  onListenerError: (error: unknown, listenerName: string, event: AnyPublishedEvent) => void;
}

/**
 * Lintel's internal event bus. Features publish what happened after the change is
 * saved; other features subscribe without the publisher knowing about them. Listeners
 * run one after another, in the order they subscribed, and `publish` waits for them, so
 * a listener that only writes something down (webhooks queue a delivery) is done by the
 * time the request answers. Slow work belongs in the background, as webhooks and
 * workflows do it.
 *
 * Checks are the other direction: a feature asks before it acts ("may this entry be
 * published?") and any feature may refuse by throwing.
 */
export class EventBus {
  private readonly subscriptions: Subscription[] = [];
  private readonly checks = new Map<string, Check<LintelCheckName>[]>();
  private readonly definitions = new Map<string, EventDefinition>(
    coreEventDefinitions.map((definition) => [definition.name, definition]),
  );

  constructor(private readonly options: EventBusOptions) {}

  /** Makes an event known to the admin, with a label and sample data. */
  declare(definition: EventDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  /** Every declared event, in the order they were declared. */
  listDefinitions(): EventDefinition[] {
    return [...this.definitions.values()];
  }

  findDefinition(name: string): EventDefinition | undefined {
    return this.definitions.get(name);
  }

  on<Name extends LintelEventName>(
    eventName: Name,
    listenerName: string,
    listener: Listener<PublishedEvent<Name>>,
  ): void {
    this.subscriptions.push({
      eventName,
      listenerName,
      // Only called with events of this name; see `publish`.
      listener: listener as Listener<AnyPublishedEvent>,
    });
  }

  onEvery(listenerName: string, listener: Listener<AnyPublishedEvent>): void {
    this.subscriptions.push({ eventName: undefined, listenerName, listener });
  }

  async publish<Name extends LintelEventName>(
    name: Name,
    data: LintelEvents[Name],
    options: PublishOptions = {},
  ): Promise<PublishedEvent<Name>> {
    const event: PublishedEvent<Name> = {
      id: randomUUID(),
      name,
      occurredAt: (options.now ?? new Date()).toISOString(),
      data,
      actor: options.actor ?? null,
      cause: options.cause ?? null,
      ...(options.fromRobot && { fromRobot: true }),
    };
    const anyEvent = event as AnyPublishedEvent;
    for (const subscription of this.subscriptions) {
      if (subscription.eventName !== undefined && subscription.eventName !== name) {
        continue;
      }
      try {
        await subscription.listener(anyEvent);
      } catch (error) {
        // The change has already been saved, so one listener failing mustn't stop the rest.
        this.options.onListenerError(error, subscription.listenerName, anyEvent);
      }
    }
    return event;
  }

  addCheck<Name extends LintelCheckName>(name: Name, check: Check<Name>): void {
    const existing = this.checks.get(name) ?? [];
    this.checks.set(name, [...existing, check as Check<LintelCheckName>]);
  }

  /** Runs every check; the first to refuse throws, and that error reaches the caller. */
  async runChecks<Name extends LintelCheckName>(
    name: Name,
    question: LintelChecks[Name],
  ): Promise<void> {
    for (const check of this.checks.get(name) ?? []) {
      await check(question);
    }
  }
}
