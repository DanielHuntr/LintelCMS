import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, uniqueTitle } from "../../src/fixtures/lintel-test.js";

// Requiring a token changes how the whole site's API answers, so these get their own site.
test.use({ site: "private" });

test("a read-only token is made and works once the API asks for one", async ({
  page,
  lintel,
  content,
}) => {
  await page.goto("/settings/api");
  await page.getByRole("button", { name: "New token" }).click();
  const sheet = page.getByRole("dialog", { name: "New API token" });
  await sheet.getByRole("textbox", { name: "Name" }).fill("Marketing website");
  await sheet.getByRole("radio", { name: /Read only/ }).check();
  await sheet.getByRole("button", { name: "Create token" }).click();

  const created = page.getByRole("dialog", { name: "“Marketing website” is ready" });
  const token = (await created.getByRole("code").textContent()) ?? "";
  expect(token.length).toBeGreaterThan(20);
  await created
    .getByRole("button", { name: /Done|Close/ })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Tokens" }).getByText("Marketing website"),
  ).toBeVisible();

  await page.getByRole("switch", { name: "Only with a token" }).click();
  await expect(page.getByRole("switch", { name: "Only with a token" })).toBeChecked();

  const address = `${lintel.apiUrl}/delivery/posts/${content.posts.published.slug}`;
  expect((await fetch(address)).status).toBe(401);
  const withToken = await fetch(address, { headers: { authorization: `Bearer ${token}` } });
  expect(withToken.status).toBe(200);

  await page
    .getByRole("region", { name: "Tokens" })
    .getByRole("button", { name: "Delete “Marketing website”" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete token" }).click();
  await expect
    .poll(
      async () => (await fetch(address, { headers: { authorization: `Bearer ${token}` } })).status,
    )
    .toBe(401);
});

test("a webhook hears about a published entry", async ({ page, api }) => {
  const received: { event: string }[] = [];
  const receiver = createServer(async (request, response) => {
    received.push(JSON.parse(await readBody(request)) as { event: string });
    response.writeHead(200).end("ok");
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/rebuild`;

  try {
    await page.goto("/settings/webhooks");
    await page.getByRole("button", { name: "Add webhook" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a webhook" });
    await sheet.getByRole("textbox", { name: "Address" }).fill(receiverUrl);
    await sheet.getByRole("textbox", { name: "Name" }).fill("Site rebuild");
    // Publishing is what most sites rebuild on, so it is switched on to start with.
    await expect(sheet.getByRole("switch", { name: "An entry is published" })).toBeChecked();
    await sheet.getByRole("button", { name: "Add webhook" }).click();
    // A new webhook opens straight away, ready to watch its deliveries.
    await expect(page.getByRole("heading", { level: 1, name: "Site rebuild" })).toBeVisible();

    const post = await api.post<{ id: string }>("/collections/posts/entries", {
      data: { title: uniqueTitle("Webhook news") },
    });
    await api.post(`/entries/${post.id}/publish`);
    await expect.poll(() => received.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByText("Delivered").first()).toBeVisible();
  } finally {
    receiver.close();
  }
});

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => resolve(body));
  });
}
