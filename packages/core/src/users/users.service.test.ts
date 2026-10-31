import { expect, it } from "vitest";
import { verifyPassword } from "../auth/passwords.js";
import { rolesTable } from "../roles/roles.table.js";
import { findPermissionsForUser } from "../roles/roles.service.js";
import { describeWithDatabase, useTestDatabase } from "../testing/test-database.js";
import { findUserByEmail } from "./users.repository.js";
import { createAdmin, EmailAlreadyUsedError } from "./users.service.js";

const ADMIN = { email: "ana@example.com", name: "Ana Admin", password: "a long admin password" };

describeWithDatabase("createAdmin", () => {
  const testDatabase = useTestDatabase();

  it("creates the Super admin role on a fresh install and gives it to the new user", async () => {
    const admin = await createAdmin(testDatabase.database, ADMIN);

    expect(admin).toMatchObject({ email: "ana@example.com", name: "Ana Admin" });
    expect(await findPermissionsForUser(testDatabase.database, admin.id)).toEqual(["*"]);

    const stored = await findUserByEmail(testDatabase.database, "default", "ana@example.com");
    expect(await verifyPassword(ADMIN.password, stored!.passwordHash!)).toBe(true);
  });

  it("reuses the existing Super admin role for a second admin", async () => {
    await createAdmin(testDatabase.database, ADMIN);
    await createAdmin(testDatabase.database, { ...ADMIN, email: "ben@example.com" });

    const roles = await testDatabase.database.select().from(rolesTable);
    expect(roles.map((role) => role.name)).toEqual(["Super admin"]);
  });

  it("refuses an email that is already used, and changes nothing", async () => {
    await createAdmin(testDatabase.database, ADMIN);

    await expect(createAdmin(testDatabase.database, ADMIN)).rejects.toThrow(EmailAlreadyUsedError);
  });
});
