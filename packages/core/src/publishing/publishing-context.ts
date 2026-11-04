import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { isLocalAddress } from "../commerce/payments/local-address.js";
import { createSecretBox, loadSecretKey, type SecretBox } from "../secrets/secret-box.js";
import type { DestinationRules } from "./destination-safety.js";
import type { PublishingDependencies } from "./publishing.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What Settings → Publishing needs besides the request (see src/publishing). */
    publishing: PublishingContext;
  }
}

/** Progress of a publish under way, for the admin's progress bar. */
export interface PublishProgress {
  step: "preparing" | "building" | "uploading" | "finishing";
  done: number;
  total: number;
}

export interface PublishingContext extends PublishingDependencies {
  api: FastifyInstance;
  destinationRules: () => DestinationRules;
  /** Where each target's exported files are kept between publishes. */
  exportsFolder: string;
  /** Publishes under way, by target id. */
  running: Map<string, { runId: string; progress: PublishProgress }>;
  /** Tests connect to servers with self-signed certificates. */
  allowSelfSignedCertificates: boolean;
  /** Tests point the companion at pretend payment services. */
  bridgeTesting: { stripeApiBase?: string; mollieApiBase?: string };
}

export interface PublishingOptions {
  exportsFolder?: string;
  allowSelfSignedCertificates?: boolean;
  bridgeTesting?: { stripeApiBase?: string; mollieApiBase?: string };
}

/** Lintel's own program, whichever way it was installed. */
const PROGRAM_FOLDER = fileURLToPath(new URL("../../../../", import.meta.url));

export function createPublishingContext(
  server: FastifyInstance,
  options: PublishingOptions = {},
): PublishingContext {
  let box: SecretBox | undefined;
  return {
    api: server,
    get database() {
      return server.database;
    },
    secretBox: () => (box ??= createSecretBox(loadSecretKey(server.lintelFolder))),
    destinationRules: () => ({
      allowPrivateAddresses:
        isLocalAddress(server.publicApiUrl) ||
        server.webhooks.sender.allowPrivateAddresses === true,
      lintelFolders: [PROGRAM_FOLDER, dirname(server.lintelFolder.dataFolder)],
    }),
    exportsFolder:
      options.exportsFolder ?? join(dirname(server.lintelFolder.dataFolder), "published"),
    running: new Map(),
    allowSelfSignedCertificates: options.allowSelfSignedCertificates ?? false,
    bridgeTesting: options.bridgeTesting ?? {},
  };
}
