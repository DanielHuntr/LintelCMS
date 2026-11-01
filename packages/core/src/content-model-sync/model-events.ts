/**
 * Tells open admin screens that the content model changed, so they reload what they show
 * (sent to browsers by `GET /content-model/events`, see content-model-sync.routes.ts).
 *
 *   - "model-changed": content types, taxonomies, global sets or menus changed;
 *   - "status-changed": the notices, pending changes or file problems changed.
 */
export type ModelEvent = "model-changed" | "status-changed";

export type ModelEventListener = (event: ModelEvent) => void;

export class ModelEvents {
  private readonly listeners = new Set<ModelEventListener>();

  /** Returns the function that stops listening. */
  subscribe(listener: ModelEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: ModelEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
