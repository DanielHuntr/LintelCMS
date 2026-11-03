import { NOT_FOUND_FILE } from "./static-files.js";

/**
 * Settings files that teach common web servers to serve an exported site the way Lintel
 * would: clean addresses ("/about" without ".html"), the site's own 404 page, the SEO
 * plugin's redirects, compression and sensible caching. Apache (most shared hosting,
 * cPanel) reads `.htaccess`; IIS (Windows hosting, Plesk on Windows) reads `web.config`.
 * nginx has no such file; the docs give the lines to paste.
 */

export interface Redirect {
  from: string;
  to: string;
  statusCode: number;
}

export const HTACCESS_FILE = ".htaccess";
export const WEB_CONFIG_FILE = "web.config";

/** Fingerprinted or versioned files, which never change under the same name. */
const LONG_CACHE = "public, max-age=31536000, immutable";
const PAGE_CACHE = "public, max-age=0, must-revalidate";

export function buildHtaccess(redirects: readonly Redirect[]): string {
  const redirectLines = redirects.map(
    (redirect) =>
      `RewriteRule ^${apacheExpression(redirect.from)}/?$ ${apacheTarget(redirect.to)} [R=${redirect.statusCode},L]`,
  );
  return [
    "# Made by Lintel each time the website is published. Change things in Lintel, not here:",
    "# this file is replaced on the next publish.",
    "Options -Indexes -MultiViews",
    "DirectoryIndex index.html index.php",
    `ErrorDocument 404 /${NOT_FOUND_FILE}`,
    "",
    "<IfModule mod_rewrite.c>",
    "  RewriteEngine On",
    ...(redirectLines.length > 0
      ? ["  # Redirects from Lintel's SEO settings", ...redirectLines.map((line) => `  ${line}`)]
      : []),
    "  # /about shows about/index.html",
    "  RewriteCond %{REQUEST_FILENAME} !-f",
    "  RewriteCond %{REQUEST_FILENAME}/index.html -f",
    "  RewriteRule ^(.+?)/?$ $1/index.html [L]",
    "</IfModule>",
    "",
    "<IfModule mod_deflate.c>",
    "  AddOutputFilterByType DEFLATE text/html text/css text/plain application/javascript application/json application/xml application/rss+xml image/svg+xml",
    "</IfModule>",
    "",
    "<IfModule mod_mime.c>",
    "  AddType image/webp .webp",
    "  AddType image/avif .avif",
    "  AddType application/rss+xml .rss",
    "</IfModule>",
    "",
    "# Lintel's own records of what it uploaded",
    '<FilesMatch "^\\.lintel">',
    "  <IfModule mod_authz_core.c>",
    "    Require all denied",
    "  </IfModule>",
    "</FilesMatch>",
    "",
    "<IfModule mod_headers.c>",
    '  <FilesMatch "\\.(html|xml|txt|json)$">',
    `    Header set Cache-Control "${PAGE_CACHE}"`,
    "  </FilesMatch>",
    '  <FilesMatch "^site-[0-9a-f]+\\.css$">',
    `    Header set Cache-Control "${LONG_CACHE}"`,
    "  </FilesMatch>",
    '  Header always set X-Content-Type-Options "nosniff"',
    '  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    "</IfModule>",
    "",
  ].join("\n");
}

/** `media/.htaccess`: every file in media/ has its version in its name. */
export function buildMediaHtaccess(): string {
  return [
    "<IfModule mod_headers.c>",
    `  Header set Cache-Control "${LONG_CACHE}"`,
    "</IfModule>",
    "",
  ].join("\n");
}

/** Keeps a folder's files from ever being served (for the companion's private folder). */
export function buildDenyAllHtaccess(): string {
  return [
    "<IfModule mod_authz_core.c>",
    "  Require all denied",
    "</IfModule>",
    "<IfModule !mod_authz_core.c>",
    "  Order allow,deny",
    "  Deny from all",
    "</IfModule>",
    "",
  ].join("\n");
}

export function buildWebConfig(redirects: readonly Redirect[]): string {
  const redirectRules = redirects.map(
    (redirect, index) =>
      `        <rule name="Lintel redirect ${index + 1}" stopProcessing="true">\n` +
      `          <match url="^${xmlEscape(apacheExpression(redirect.from))}/?$" />\n` +
      `          <action type="Redirect" url="${xmlEscape(redirect.to)}" redirectType="${iisRedirectType(redirect.statusCode)}" />\n` +
      "        </rule>",
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Made by Lintel each time the website is published. Change things in Lintel, not here. -->",
    "<configuration>",
    "  <system.webServer>",
    "    <defaultDocument>",
    "      <files>",
    "        <clear />",
    '        <add value="index.html" />',
    '        <add value="index.php" />',
    "      </files>",
    "    </defaultDocument>",
    '    <httpErrors errorMode="Custom" existingResponse="Replace">',
    '      <remove statusCode="404" />',
    `      <error statusCode="404" path="/${NOT_FOUND_FILE}" responseMode="ExecuteURL" />`,
    "    </httpErrors>",
    "    <rewrite>",
    "      <rules>",
    ...redirectRules,
    '        <rule name="Lintel clean addresses" stopProcessing="true">',
    '          <match url="^(.+?)/?$" />',
    '          <conditions logicalGrouping="MatchAll">',
    '            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />',
    '            <add input="{REQUEST_FILENAME}\\index.html" matchType="IsFile" />',
    "          </conditions>",
    '          <action type="Rewrite" url="{R:1}/index.html" />',
    "        </rule>",
    "      </rules>",
    "    </rewrite>",
    '    <urlCompression doStaticCompression="true" />',
    "    <staticContent>",
    '      <remove fileExtension=".webp" />',
    '      <mimeMap fileExtension=".webp" mimeType="image/webp" />',
    '      <remove fileExtension=".avif" />',
    '      <mimeMap fileExtension=".avif" mimeType="image/avif" />',
    '      <remove fileExtension=".json" />',
    '      <mimeMap fileExtension=".json" mimeType="application/json" />',
    "    </staticContent>",
    "  </system.webServer>",
    "</configuration>",
    "",
  ].join("\n");
}

/** A path as an anchored regular expression without its leading slash. */
function apacheExpression(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\ ");
}

function apacheTarget(to: string): string {
  return to.replace(/ /g, "%20");
}

function iisRedirectType(statusCode: number): string {
  if (statusCode === 302) return "Found";
  if (statusCode === 307) return "Temporary";
  return "Permanent";
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
