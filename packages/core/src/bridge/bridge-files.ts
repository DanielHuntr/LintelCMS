import { readFileSync } from "node:fs";
import { buildDenyAllHtaccess } from "../static-site/host-settings.js";

/**
 * The files of the PHP companion: `lintel-bridge.php` beside the website, and in its
 * private folder the settings Lintel writes for it. The settings are PHP that returns an
 * array, so even a host that serves the private folder by mistake shows nothing.
 */

export const BRIDGE_FILE = "lintel-bridge.php";
/** The oldest PHP the companion runs on; `LINTEL_BRIDGE_MINIMUM_PHP` in the PHP says the same. */
export const BRIDGE_MINIMUM_PHP_VERSION = "7.4";
export const BRIDGE_CONFIG_FILE = "config.php";
export const BRIDGE_FORMS_FILE = "forms.php";
export const BRIDGE_CATALOGUE_FILE = "catalogue.php";

/**
 * The top of every private file, matching `LINTEL_FILE_GUARD` in the PHP. A private file is a
 * PHP file that stops at once, so a browser that reaches it gets nothing, on any server.
 */
export const BRIDGE_FILE_GUARD = "<?php exit; __halt_compiler();\n";

export function guardPrivateFile(content: string): string {
  return `${BRIDGE_FILE_GUARD}${content}`;
}

export function unguardPrivateFile(content: string): string {
  return content.startsWith(BRIDGE_FILE_GUARD) ? content.slice(BRIDGE_FILE_GUARD.length) : content;
}

let script: string | undefined;

/** The companion as uploaded: the same file for every site. */
export function readBridgeScript(): string {
  script ??= readFileSync(new URL("./lintel-bridge.php", import.meta.url), "utf8");
  return script;
}

export interface BridgeSettings {
  secret: string;
  siteAddress: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  mollieApiKey: string | null;
  /** Email the site owner from the host as each form arrives (PHP's mail()). */
  emailFromHost: boolean;
  emailFrom: string;
  /** Tests point the companion at pretend payment services. */
  stripeApiBase?: string;
  mollieApiBase?: string;
}

export function buildBridgeConfig(settings: BridgeSettings): string {
  const entries = Object.entries(settings)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `    ${phpString(key)} => ${phpValue(value as string | boolean)},`);
  return [
    "<?php",
    "// Written by Lintel on each publish. It holds keys: never put it inside your website.",
    "return [",
    ...entries,
    "];",
    "",
  ].join("\n");
}

/** What else goes in the private folder: nothing in it may ever be served. */
export function privateFolderGuards(): Array<{ path: string; content: string }> {
  return [
    { path: ".htaccess", content: buildDenyAllHtaccess() },
    { path: "index.html", content: "" },
    { path: "web.config", content: denyAllWebConfig },
  ];
}

const denyAllWebConfig = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>',
  "",
].join("\n");

function phpValue(value: string | boolean): string {
  return typeof value === "boolean" ? String(value) : phpString(value);
}

/** A single-quoted PHP string: only backslashes and quotes need escaping. */
export function phpString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
