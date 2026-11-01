// lintel-updater: the opt-in service that lets the Update button work on Docker installs.
//
// Lintel can't safely replace its own container from inside it, so this small service does
// it from beside it. It listens on the compose network only (never publish its port) and
// accepts one request, POST /update { "version": "1.2.0" } with the shared token in
// `Authorization: Bearer <LINTEL_UPDATER_TOKEN>`. It then runs the same two commands
// Settings → Updates shows:
//
//   git fetch --tags && git checkout v<version>
//   docker compose -f deploy/docker-compose.yml up -d --build lintel
//
// The trade-off: it needs the Docker socket, which is the same as root on this machine.
// That is why it is off unless you start compose with `--profile updater` (see "Updating
// Lintel" in the docs). Lintel makes a backup before it asks.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

const token = process.env.LINTEL_UPDATER_TOKEN ?? "";
const repository = process.env.LINTEL_REPO_PATH ?? "";
const port = Number(process.env.PORT ?? 8080);
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

if (token.length < 32 || !repository) {
  console.error("Set LINTEL_UPDATER_TOKEN (32 characters or more) and LINTEL_REPO_PATH.");
  process.exit(1);
}

let running = null;

function say(message) {
  console.log(`[lintel-updater] ${message}`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    say(`$ ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { cwd: repository, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repository, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function update(version) {
  const changes = (await capture("git", ["status", "--porcelain", "--untracked-files=no"])).trim();
  if (changes) {
    throw new Error("The repository has changes that aren't committed; nothing was updated.");
  }
  await run("git", ["fetch", "--tags"]);
  await run("git", ["checkout", "--quiet", "--detach", `v${version}`]);
  await run("docker", [
    "compose",
    "-f",
    "deploy/docker-compose.yml",
    "up",
    "-d",
    "--build",
    "lintel",
  ]);
  say(`Lintel ${version} is starting.`);
}

function authorised(request) {
  const given = Buffer.from((request.headers.authorization ?? "").replace(/^Bearer /, ""));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function answer(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return answer(response, 200, { status: "ok", updating: running !== null });
  }
  if (request.method !== "POST" || request.url !== "/update") {
    return answer(response, 404, { error: "Not found" });
  }
  if (!authorised(request)) {
    return answer(response, 401, { error: "Wrong token" });
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024) request.destroy();
  });
  request.on("end", () => {
    let version;
    try {
      version = JSON.parse(body).version;
    } catch {
      return answer(response, 400, { error: 'Send { "version": "1.2.0" }' });
    }
    if (typeof version !== "string" || !VERSION.test(version)) {
      return answer(response, 400, { error: "That isn't a version number" });
    }
    if (running) {
      return answer(response, 409, { error: "An update is already running" });
    }
    answer(response, 202, { started: true, version });
    running = update(version)
      .catch((error) => say(`The update didn't work: ${error.message}`))
      .finally(() => {
        running = null;
      });
  });
}).listen(port, () => say(`Listening on port ${port}`));
