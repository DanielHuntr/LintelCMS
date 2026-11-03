import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { multipartFiles } from "../testing/multipart.js";
import { useDataToolsTestServer } from "../testing/test-data-tools.js";
import { useTestDatabase } from "../testing/test-database.js";

/**
 * The whole move from WordPress, as the admin makes the calls: upload the export, look at
 * what was found, map a custom field, check with a dry run, start, follow the progress to
 * the report, then see the result on the website's APIs and accept a suggested redirect.
 * Uploading the same export again brings nothing in twice.
 */
const gardenShop = readFileSync(new URL("./fixtures/garden-shop.xml", import.meta.url));

describe("moving a site from WordPress, start to finish", { timeout: 90_000 }, () => {
  const testDatabase = useTestDatabase();
  const tools = useDataToolsTestServer(testDatabase);

  async function upload() {
    const response = await tools.server.inject({
      method: "POST",
      url: "/wordpress-imports",
      cookies: tools.cookies,
      ...multipartFiles([{ fieldName: "export", filename: "fernleaf.xml", contents: gardenShop }]),
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<{ id: string; status: string }>();
  }

  async function waitForReport(importId: string) {
    await tools.server.dataTools.tasks.finishAll();
    return (await tools.api("GET", `/wordpress-imports/${importId}`)).json<{
      status: string;
      progress: { done: number; total: number };
      report: { counts: Record<string, { done: number; skipped: number }>; problems: unknown[] };
    }>();
  }

  it("goes from the export to live pages, a menu and redirects", async () => {
    await setEnabledPlugins(testDatabase.database, tools.server.plugins, ["seo"]);
    const page = (await tools.api("GET", "/blueprints/page")).json<{
      name: string;
      fields: unknown[];
    }>();
    await tools.api("PUT", "/blueprints/page", {
      name: page.name,
      fields: [
        ...page.fields,
        { handle: "opening_note", label: "Opening note", type: "text", options: {} },
      ],
    });

    const created = await upload();
    expect(created.status).toBe("ready");
    const choices = (await tools.api("GET", `/wordpress-imports/${created.id}/mapping`)).json<{
      suggested: Record<string, unknown>;
    }>();
    const saved = await tools.api("PUT", `/wordpress-imports/${created.id}/mapping`, {
      ...choices.suggested,
      pageFields: { opening_note: "opening_note", parking_spaces: null, reopens_on: null },
    });
    expect(saved.statusCode, saved.body).toBe(200);

    const dryRun = (await tools.api("POST", `/wordpress-imports/${created.id}/dry-run`)).json<{
      counts: Record<string, { done: number }>;
    }>();
    expect(dryRun.counts.page?.done).toBe(2);
    expect((await tools.api("GET", "/delivery/navigation/footer_links")).statusCode).toBe(404);

    expect((await tools.api("POST", `/wordpress-imports/${created.id}/start`)).statusCode).toBe(
      202,
    );
    const finished = await waitForReport(created.id);
    expect(finished.status).toBe("complete");
    expect(finished.progress.done).toBe(finished.progress.total);
    expect(finished.report.problems).toEqual([]);

    const visit = (await tools.api("GET", "/delivery/pages/visit-us")).json<{
      data: Record<string, unknown>;
    }>();
    expect(visit.data.opening_note).toBe("Closed on Christmas Day");
    const menu = (await tools.api("GET", "/delivery/navigation/footer_links")).json<{
      items: Array<{ label: string; url: string; children: Array<{ url: string }> }>;
    }>();
    expect(menu.items.map((item) => item.url)).toEqual(["/", "/delivery/"]);
    expect(menu.items[0]?.children.map((child) => child.url)).toEqual(["/seed-sowing-guide"]);

    const suggested = (await tools.api("GET", "/seo/redirects?status=suggested")).json<{
      redirects: Array<{ id: string; fromPath: string; toPath: string }>;
    }>();
    const sowing = suggested.redirects.find(
      (redirect) => redirect.fromPath === "/visit-us/seed-sowing-guide",
    );
    expect(sowing?.toPath).toBe("/seed-sowing-guide");
    const accepted = await tools.api("PATCH", `/seo/redirects/${sowing?.id}`, { status: "active" });
    expect(accepted.statusCode, accepted.body).toBe(200);

    const again = await upload();
    await tools.api("PUT", `/wordpress-imports/${again.id}/mapping`, choices.suggested);
    await tools.api("POST", `/wordpress-imports/${again.id}/start`);
    const second = await waitForReport(again.id);
    expect(second.report.counts.page).toMatchObject({ done: 0, skipped: 2 });
  });
});
