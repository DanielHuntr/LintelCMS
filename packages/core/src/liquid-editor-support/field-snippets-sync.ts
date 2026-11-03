import { existsSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { mayChangeContentModel } from "../content-model-sync/model-lock.js";
import { readContentModelFromDatabase, writeEditorSnippets } from "./liquid-editor-commands.js";

const SYNC_DELAY_MILLISECONDS = 300;

/**
 * In development, keeps the field snippets in step with the content types, so a field
 * added in the admin or in a content model file is suggested in templates straight away.
 * It runs when the server is ready, after admin requests that may change the content model
 * (the same rule content model sync uses), and after content model files were applied.
 *
 * Only while the templates folder exists: a project that doesn't use Liquid templates
 * gets no `.vscode` files. Called beside the API's routes, since it watches their requests.
 */
export function registerFieldSnippetsSync(api: FastifyInstance): void {
  const templates = api.website.liquidTemplates;
  const snippetsFolder = templates?.options.editorSnippetsFolder;
  if (!templates || templates.options.development !== true || !snippetsFolder) return;
  const templatesFolder = templates.options.folder;

  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();
  const writeNow = async () => {
    if (!existsSync(templatesFolder)) return;
    try {
      const model = await readContentModelFromDatabase(api.database);
      await writeEditorSnippets(snippetsFolder, model);
    } catch (error) {
      api.log.error(error, "Writing the snippets for Liquid templates failed");
    }
  };
  // One write after a burst of changes, and never two at once.
  const requestWrite = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      running = running.then(writeNow);
    }, SYNC_DELAY_MILLISECONDS);
  };

  api.addHook("onReady", async () => {
    running = running.then(writeNow);
    await running;
  });
  api.addHook("onResponse", async (request, reply) => {
    const url = request.url.startsWith(api.prefix)
      ? request.url.slice(api.prefix.length) || "/"
      : request.url;
    if (
      reply.statusCode < 400 &&
      mayChangeContentModel({ method: request.method, url, body: request.body })
    )
      requestWrite();
  });
  const stopListening = api.contentModelEvents.subscribe((event) => {
    if (event === "model-changed") requestWrite();
  });
  api.addHook("onClose", async () => {
    stopListening();
    clearTimeout(timer);
    await running;
  });
}
