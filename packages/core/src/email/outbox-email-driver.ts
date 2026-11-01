import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailDriver } from "./email-driver.js";
import type { OutgoingEmail } from "./email.schema.js";

export interface OutboxEmail extends OutgoingEmail {
  id: string;
  sentAt: string;
}

/**
 * Keeps emails instead of sending them: the default until a real driver is set, so
 * development and tests never email anyone by mistake. With a folder, each email is
 * written to `<folder>/<time>-<id>.json` to read later; without one, they are only kept in
 * memory (tests read `sent`).
 */
export class OutboxEmailDriver implements EmailDriver {
  readonly description: string;
  readonly sent: OutboxEmail[] = [];

  constructor(private readonly folder?: string) {
    this.description = folder ? `the outbox in ${folder} (nothing is really sent)` : "the outbox";
  }

  async send(email: OutgoingEmail) {
    const kept: OutboxEmail = { ...email, id: randomUUID(), sentAt: new Date().toISOString() };
    this.sent.push(kept);
    if (this.folder) {
      await mkdir(this.folder, { recursive: true });
      const name = `${kept.sentAt.replace(/[:.]/g, "-")}-${kept.id}.json`;
      await writeFile(join(this.folder, name), `${JSON.stringify(kept, null, 2)}\n`);
    }
    return { messageId: kept.id };
  }

  /** Everything in the outbox folder, oldest first. */
  async readFolder(): Promise<OutboxEmail[]> {
    if (!this.folder) return [...this.sent];
    let names: string[];
    try {
      names = (await readdir(this.folder)).filter((name) => name.endsWith(".json")).sort();
    } catch {
      return [];
    }
    const folder = this.folder;
    return Promise.all(
      names.map(
        async (name) => JSON.parse(await readFile(join(folder, name), "utf8")) as OutboxEmail,
      ),
    );
  }
}
