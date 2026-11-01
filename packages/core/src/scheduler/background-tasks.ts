/**
 * Work started by a request that carries on after the response is sent, such as making a
 * backup or running an import. The request answers straight away with something to poll;
 * the work reports its own progress in the database.
 *
 * The server waits for these when it closes, so stopping Lintel never cuts a backup off
 * half way unless the process itself is killed.
 */
export class BackgroundTasks {
  private readonly running = new Set<Promise<void>>();

  constructor(private readonly onError: (error: unknown) => void) {}

  /** Starts `task` without waiting for it. Its failure goes to `onError`. */
  start(task: () => Promise<void>): void {
    const promise = task()
      .catch(this.onError)
      .finally(() => this.running.delete(promise));
    this.running.add(promise);
  }

  /** Resolves once everything started so far has finished. */
  async finishAll(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all([...this.running]);
    }
  }
}
