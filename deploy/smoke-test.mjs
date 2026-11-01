// Checks that a running Lintel serves what it should, from the outside:
//
//   node deploy/smoke-test.mjs http://localhost:4000
//
// It waits up to a minute for /ready, then checks the API, the admin and the website.
// CI runs it against the Docker image; it is just as useful after a deploy.
const baseUrl = (process.argv[2] ?? "http://localhost:4000").replace(/\/+$/, "");
const failures = [];

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  let last = "no answer";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) return;
      last = `${response.status} ${await response.text()}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Lintel wasn't ready after a minute. Last answer from /ready: ${last}`);
}

async function check(description, path, test) {
  try {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    const problem = test(response, body);
    if (problem) failures.push(`${description} (${path}): ${problem}`);
    else console.log(`ok   ${description}`);
  } catch (error) {
    failures.push(`${description} (${path}): ${error instanceof Error ? error.message : error}`);
  }
}

await waitUntilReady();
console.log(`ok   ${baseUrl}/ready says ready`);

await check("health check", "/health", (response) =>
  response.status === 200 ? undefined : `status ${response.status}`,
);
await check("API under /api", "/api/setup/status", (response, body) => {
  if (response.status !== 200) return `status ${response.status}`;
  if (!("needsSetup" in JSON.parse(body))) return "no needsSetup in the answer";
  if (response.headers.get("x-request-id") === null) return "no x-request-id header";
});
await check("admin page", "/admin/", (response, body) => {
  if (response.status !== 200) return `status ${response.status}`;
  if (!body.includes('name="lintel-admin"')) return "the admin's settings tag is missing";
  if (!body.includes('<base href="/admin/"')) return "the <base> tag is missing";
});
await check("admin deep link", "/admin/content", (response) =>
  response.status === 200 ? undefined : `status ${response.status}`,
);
await check("website", "/", (response) =>
  response.status === 200 ? undefined : `status ${response.status}`,
);

if (failures.length > 0) {
  console.error(
    `\n${failures.length} check(s) failed:\n${failures.map((line) => `  - ${line}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("\nEverything Lintel should serve is there.");
