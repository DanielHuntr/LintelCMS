import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteBlueprintRow,
  findBlueprintByHandle,
  findBlueprintById,
  insertBlueprint,
  insertBlueprintIfMissing,
  listBlueprintRows,
  updateBlueprintFields,
} from "./blueprints.repository.js";

const TENANT = "default";
const page = { handle: "page", name: "Page", kind: "entry" } as const;

describeOnEveryDatabase("Blueprints", (handle) => {
  it("saves and finds a blueprint", async () => {
    const { database } = handle;
    const blueprint = await insertBlueprint(database, page);
    expect(blueprint.version).toBe(1);
    expect((await findBlueprintByHandle(database, TENANT, "page"))?.id).toBe(blueprint.id);
    expect((await findBlueprintById(database, blueprint.id))?.handle).toBe("page");
    expect(await listBlueprintRows(database, TENANT)).toHaveLength(1);
  });

  it("adds one only if the handle is free", async () => {
    const { database } = handle;
    expect(await insertBlueprintIfMissing(database, page)).toBeDefined();
    expect(await insertBlueprintIfMissing(database, page)).toBeUndefined();
  });

  it("moves the version on with each save, and deletes", async () => {
    const { database } = handle;
    const blueprint = await insertBlueprint(database, page);
    const saved = await updateBlueprintFields(database, blueprint.id, {
      name: "Pages",
      fields: [],
    });
    expect(saved).toMatchObject({ name: "Pages", version: 2 });
    await deleteBlueprintRow(database, blueprint.id);
    expect(await listBlueprintRows(database, TENANT)).toEqual([]);
  });
});
