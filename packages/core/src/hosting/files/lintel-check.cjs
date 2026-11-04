// Can this server run Lintel? Upload this one file and either:
//
//   - in cPanel's "Setup Node.js App", create an app with lintel-check.js as its startup
//     file and open the app's address in your browser; or
//   - run `node lintel-check.js` in a terminal.
//
// It needs nothing else installed, and changes nothing except a test file it removes again.
// It is written for old versions of Node.js too, so it can tell you when yours is too old.
"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var http = require("http");
var https = require("https");

var MINIMUM_NODE_MAJOR = 22;
var MINIMUM_MEMORY_MB = 512;
var COMFORTABLE_MEMORY_MB = 1024;
var HTTPS_TEST_URL = "https://registry.npmjs.org/-/ping";
// The guides, on GitHub until the documentation site has its own address.
var GUIDES =
  "https://github.com/DanielHuntr/lintelcms/blob/main/packages/docs/src/content/docs/hosting/";
var CPANEL_GUIDE = GUIDES + "cpanel.md";
var CHOOSING_GUIDE = GUIDES + "choose.md";

// ---- Facts: what this server is like ----

function readNumberFromFile(file) {
  try {
    var text = fs.readFileSync(file, "utf8").trim();
    if (text === "max" || text === "") return undefined;
    var value = Number(text);
    return isFinite(value) ? value : undefined;
  } catch (error) {
    return undefined;
  }
}

/** The memory limit the hosting account runs under (cgroups, which CloudLinux uses), in MB. */
function readMemoryLimitMb() {
  var candidates = ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"];
  // With cgroups version 1, this process's own group can have a lower limit than the root.
  try {
    var groups = fs.readFileSync("/proc/self/cgroup", "utf8").split("\n");
    groups.forEach(function (line) {
      var parts = line.split(":");
      if (parts[1] === "memory" && parts[2] && parts[2] !== "/") {
        candidates.unshift("/sys/fs/cgroup/memory" + parts[2] + "/memory.limit_in_bytes");
      }
      if (parts[0] === "0" && parts[2] && parts[2] !== "/") {
        candidates.unshift("/sys/fs/cgroup" + parts[2] + "/memory.max");
      }
    });
  } catch (error) {
    // Not Linux, or not readable: the machine-wide figures are used.
  }
  for (var index = 0; index < candidates.length; index++) {
    var bytes = readNumberFromFile(candidates[index]);
    // Kernels report "no limit" as an enormous number.
    if (bytes !== undefined && bytes < Math.pow(2, 50)) return Math.round(bytes / 1048576);
  }
  return undefined;
}

/** The "virtual memory" limit (ulimit -v), which stops the built-in database from starting. */
function readAddressSpaceLimitMb() {
  try {
    var limits = fs.readFileSync("/proc/self/limits", "utf8");
    var match = /Max address space\s+(\S+)/.exec(limits);
    if (!match || match[1] === "unlimited") return undefined;
    return Math.round(Number(match[1]) / 1048576);
  } catch (error) {
    return undefined;
  }
}

/** The built-in database runs in WebAssembly, which reserves a large block of memory. */
function checkWebAssemblyMemory() {
  if (typeof WebAssembly === "undefined") return "WebAssembly isn't available";
  try {
    new WebAssembly.Memory({ initial: 256, maximum: 32768 });
    return undefined;
  } catch (error) {
    return error && error.message ? error.message : String(error);
  }
}

function checkWritable(folder) {
  var probe = path.join(folder, ".lintel-check-" + process.pid);
  try {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return { folder: folder, writable: true };
  } catch (error) {
    return { folder: folder, writable: false, problem: error.code || error.message };
  }
}

function checkSharp(appFolder) {
  var location;
  try {
    location = require.resolve("sharp", { paths: [appFolder] });
  } catch (error) {
    return { state: "not-installed" };
  }
  try {
    require(location);
    return { state: "loaded" };
  } catch (error) {
    var message = error && error.message ? error.message.split("\n")[0] : String(error);
    return { state: "failed", problem: message };
  }
}

function checkOutboundHttps(callback) {
  var finished = false;
  function finish(result) {
    if (finished) return;
    finished = true;
    callback(result);
  }
  try {
    var options = require("url").parse(HTTPS_TEST_URL);
    options.timeout = 8000;
    var request = https.get(options, function (response) {
      response.resume();
      finish({ ok: response.statusCode < 500 });
    });
    request.on("timeout", function () {
      request.destroy();
      finish({ ok: false, problem: "no answer within 8 seconds" });
    });
    request.on("error", function (error) {
      finish({ ok: false, problem: error.code || error.message });
    });
  } catch (error) {
    finish({ ok: false, problem: error.message });
  }
}

/**
 * Everything the report needs, gathered from this server. `folders` are the ones Lintel
 * must write to: by default its own folder, its data folder and the restart folder.
 */
function gatherFacts(appFolder, callback, folders) {
  var foldersToCheck = folders || [
    appFolder,
    path.join(appFolder, ".lintel"),
    path.join(appFolder, "tmp"),
  ];
  var facts = {
    nodeVersion: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    totalMemoryMb: Math.round(os.totalmem() / 1048576),
    memoryLimitMb: readMemoryLimitMb(),
    addressSpaceLimitMb: readAddressSpaceLimitMb(),
    webAssemblyProblem: checkWebAssemblyMemory(),
    folders: foldersToCheck.map(checkWritable),
    sharp: checkSharp(appFolder),
    passenger: typeof PhusionPassenger !== "undefined",
  };
  checkOutboundHttps(function (result) {
    facts.outboundHttps = result;
    callback(facts);
  });
}

// ---- The report: what the facts mean, in plain English ----

function nodeMajor(version) {
  return Number(String(version).split(".")[0]);
}

/**
 * Each check is "pass", "warn" (Lintel runs, with a limit) or "fail" (it can't run yet).
 * `askHost` is what to ask the hosting company, ready to paste into a support ticket.
 */
function buildReport(facts) {
  var checks = [];

  var major = nodeMajor(facts.nodeVersion);
  checks.push(
    major >= MINIMUM_NODE_MAJOR
      ? { name: "Node.js version", status: "pass", detail: "Node.js " + facts.nodeVersion }
      : {
          name: "Node.js version",
          status: "fail",
          detail:
            "This is Node.js " +
            facts.nodeVersion +
            ". Lintel needs " +
            MINIMUM_NODE_MAJOR +
            " or newer. In Setup Node.js App, pick the newest version in the list.",
          askHost:
            "Please add Node.js " + MINIMUM_NODE_MAJOR + " (or newer) to the Node.js Selector.",
        },
  );

  var memoryMb = facts.memoryLimitMb !== undefined ? facts.memoryLimitMb : facts.totalMemoryMb;
  var memoryWords =
    memoryMb + " MB" + (facts.memoryLimitMb !== undefined ? " for this account" : "");
  if (memoryMb < MINIMUM_MEMORY_MB) {
    checks.push({
      name: "Memory",
      status: "fail",
      detail: memoryWords + ". Lintel needs at least " + MINIMUM_MEMORY_MB + " MB.",
      askHost: "Please raise my account's memory limit to at least 1 GB.",
    });
  } else if (memoryMb < COMFORTABLE_MEMORY_MB) {
    checks.push({
      name: "Memory",
      status: "warn",
      detail:
        memoryWords +
        ". Enough for Lintel with your host's PostgreSQL database. The built-in database " +
        "needs 1 GB: about 800 MB the first time Lintel starts, and 470 MB after that.",
      askHost:
        "Please raise my account's memory limit to 1 GB, or tell me how to create a PostgreSQL database.",
    });
  } else {
    checks.push({ name: "Memory", status: "pass", detail: memoryWords });
  }

  if (facts.webAssemblyProblem || facts.addressSpaceLimitMb !== undefined) {
    checks.push({
      name: "Built-in database",
      status: "warn",
      detail:
        "This account limits virtual memory" +
        (facts.addressSpaceLimitMb !== undefined
          ? " to " + facts.addressSpaceLimitMb + " MB"
          : "") +
        ", which the built-in database needs. Choose your host's PostgreSQL database in the setup wizard instead.",
      askHost:
        "Please remove the virtual memory (VMEM) limit for my account, or tell me how to create a PostgreSQL database.",
    });
  } else {
    checks.push({
      name: "Built-in database",
      status: "pass",
      detail: "Can run here, so you don't need a database server",
    });
  }

  var blockedFolders = facts.folders.filter(function (folder) {
    return !folder.writable;
  });
  checks.push(
    blockedFolders.length === 0
      ? { name: "Saving files", status: "pass", detail: "Lintel can save its files here" }
      : {
          name: "Saving files",
          status: "fail",
          detail:
            "Lintel can't save files in " +
            blockedFolders
              .map(function (folder) {
                return folder.folder + " (" + folder.problem + ")";
              })
              .join(", ") +
            ". In File Manager, set these folders' permissions to 755.",
          askHost: "Please let my Node.js app write to its own application folder.",
        },
  );

  if (facts.sharp.state === "loaded") {
    checks.push({ name: "Image resizing", status: "pass", detail: "Pictures can be resized" });
  } else if (facts.sharp.state === "not-installed") {
    checks.push({
      name: "Image resizing",
      status: "warn",
      detail:
        "Not installed yet. After uploading Lintel, click Run NPM Install, then check again. " +
        "(" +
        facts.platform +
        "-" +
        facts.architecture +
        ")",
    });
  } else {
    checks.push({
      name: "Image resizing",
      status: "warn",
      detail:
        "sharp is installed but can't load (" +
        facts.sharp.problem +
        "). Lintel still runs; images are shown at the size they were uploaded.",
      askHost: "Please allow Node.js native modules (the sharp package) for my account.",
    });
  }

  checks.push(
    facts.outboundHttps && facts.outboundHttps.ok
      ? { name: "Internet access", status: "pass", detail: "This server can reach other websites" }
      : {
          name: "Internet access",
          status: "warn",
          detail:
            "This server couldn't reach " +
            HTTPS_TEST_URL +
            " (" +
            (facts.outboundHttps ? facts.outboundHttps.problem : "not checked") +
            "). Installing packages, sending email through a service, payments and webhooks need it.",
          askHost: "Please allow outgoing HTTPS connections (port 443) from my Node.js app.",
        },
  );

  var failed = checks.filter(function (check) {
    return check.status === "fail";
  });
  var warned = checks.filter(function (check) {
    return check.status === "warn";
  });
  var verdict = failed.length > 0 ? "blocked" : warned.length > 0 ? "runs-with-limits" : "runs";
  var headline =
    verdict === "blocked"
      ? "Lintel can't run here yet."
      : verdict === "runs-with-limits"
        ? "Lintel will run here, with the limits below."
        : "Lintel will run here.";
  var askHost = checks
    .filter(function (check) {
      return check.askHost && check.status !== "pass";
    })
    .map(function (check) {
      return check.askHost;
    });

  return { verdict: verdict, headline: headline, checks: checks, askHost: askHost };
}

// ---- Showing the report ----

var STATUS_WORDS = { pass: "OK", warn: "Note", fail: "Problem" };

function formatText(report) {
  var lines = ["", report.headline, ""];
  report.checks.forEach(function (check) {
    lines.push("  [" + STATUS_WORDS[check.status] + "] " + check.name + ": " + check.detail);
  });
  if (report.askHost.length > 0) {
    lines.push("", "What to ask your hosting company:");
    report.askHost.forEach(function (question) {
      lines.push("  - " + question);
    });
  }
  lines.push("", "Next: " + (report.verdict === "blocked" ? CHOOSING_GUIDE : CPANEL_GUIDE), "");
  return lines.join("\n");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHtml(report) {
  var rows = report.checks
    .map(function (check) {
      return (
        '<li class="' +
        check.status +
        '"><strong>' +
        STATUS_WORDS[check.status] +
        ": " +
        escapeHtml(check.name) +
        "</strong><br />" +
        escapeHtml(check.detail) +
        "</li>"
      );
    })
    .join("\n");
  var ask =
    report.askHost.length === 0
      ? ""
      : "<h2>What to ask your hosting company</h2><ul>" +
        report.askHost
          .map(function (question) {
            return "<li>" + escapeHtml(question) + "</li>";
          })
          .join("") +
        "</ul>";
  var next =
    report.verdict === "blocked"
      ? '<p>Other ways to run Lintel: <a href="' +
        CHOOSING_GUIDE +
        '">Choose where to host Lintel</a>.</p>'
      : '<p>Next: <a href="' +
        CPANEL_GUIDE +
        '">Install Lintel on cPanel hosting</a>. ' +
        "When you are done checking, delete this app and lintel-check.js.</p>";
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    '<meta name="robots" content="noindex" /><title>Can this server run Lintel?</title>' +
    "<style>:root{color-scheme:light dark;font-family:system-ui,sans-serif}" +
    "body{max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}" +
    "ul.checks{list-style:none;padding:0}ul.checks li{padding:.6rem .8rem;margin:.5rem 0;border-radius:.5rem;border-left:.3rem solid}" +
    "ul.checks li.pass{border-color:#2e7d32}ul.checks li.warn{border-color:#b26a00}ul.checks li.fail{border-color:#c62828}" +
    "a{color:#7539fd}@media (prefers-color-scheme:dark){a{color:#a98bff}}</style></head><body>" +
    "<main><h1>" +
    escapeHtml(report.headline) +
    '</h1><ul class="checks">' +
    rows +
    "</ul>" +
    ask +
    next +
    "</main></body></html>"
  );
}

// ---- Running it ----

function serveReport(appFolder) {
  var server = http.createServer(function (request, response) {
    gatherFacts(appFolder, function (facts) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(formatHtml(buildReport(facts)));
    });
  });
  if (typeof PhusionPassenger !== "undefined") {
    PhusionPassenger.configure({ autoInstall: false });
    server.listen("passenger");
  } else {
    var port = Number(process.env.PORT) || 4000;
    server.listen(port, function () {
      console.log("Open http://localhost:" + port + " to see the report.");
    });
  }
}

module.exports = {
  gatherFacts: gatherFacts,
  buildReport: buildReport,
  formatText: formatText,
  formatHtml: formatHtml,
};

var appFolder = __dirname;
if (typeof PhusionPassenger !== "undefined" || process.argv.indexOf("--serve") !== -1) {
  serveReport(appFolder);
} else if (require.main === module) {
  gatherFacts(appFolder, function (facts) {
    var report = buildReport(facts);
    if (process.argv.indexOf("--json") !== -1) {
      console.log(JSON.stringify({ facts: facts, report: report }, null, 2));
    } else {
      console.log(formatText(report));
    }
    process.exitCode = report.verdict === "blocked" ? 1 : 0;
  });
}
