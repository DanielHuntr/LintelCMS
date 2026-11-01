import { describe, expect, it } from "vitest";
import { verifyPassword } from "../auth/passwords.js";
import { rolesTable } from "../roles/roles.table.js";
import { startSession } from "../sessions/sessions.service.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { findPermissionsForUser } from "../roles/roles.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { findUserByEmail } from "./users.repository.js";
import {
  createAdmin,
  EmailAlreadyUsedError,
  resetPassword,
  UserNotFoundError,
} from "./users.service.js";

const ADMIN = { email: "ana@example.com", name: "Ana Admin", password: "a long admin password" };

describe("createAdmin", () => {
  const testDatabase = useTestDatabase();

  it("creates the built-in roles on a fresh install and makes the new user an Owner and gives it to the new user", async () => {
    const admin = await createAdmin(testDatabase.database, ADMIN);

    expect(admin).toMatchObject({ email: "ana@example.com", name: "Ana Admin" });
    expect(await findPermissionsForUser(testDatabase.database, admin.id)).toEqual(["*"]);

    const stored = await findUserByEmail(testDatabase.database, "default", "ana@example.com");
    expect(await verifyPassword(ADMIN.password, stored!.passwordHash!)).toBe(true);
  });

  it("reuses the existing roles for a second admin", async () => {
    await createAdmin(testDatabase.database, ADMIN);
    await createAdmin(testDatabase.database, { ...ADMIN, email: "ben@example.com" });

    const roles = await testDatabase.database.select().from(rolesTable);
    expect(roles.map((role) => role.name).sort()).toEqual([
      "Admin",
      "Author",
      "Editor",
      "Owner",
      "Viewer",
    ]);
  });

  it("refuses an email that is already used, and changes nothing", async () => {
    await createAdmin(testDatabase.database, ADMIN);

    await expect(createAdmin(testDatabase.database, ADMIN)).rejects.toThrow(EmailAlreadyUsedError);
  });
});

describe("resetPassword", () => {
  const testDatabase = useTestDatabase();
  const NEW_PASSWORD = "a brand new long password";

  it("changes the password and signs the user out everywhere", async () => {
    const admin = await createAdmin(testDatabase.database, ADMIN);
    await startSession(testDatabase.database, admin.id, "Firefox on Windows");
    await startSession(testDatabase.database, admin.id, "Safari on iPhone");

    const reset = await resetPassword(testDatabase.database, "ana@example.com", NEW_PASSWORD);

    expect(reset).toEqual({ user: admin, endedSessions: 2 });
    expect(await testDatabase.database.select().from(sessionsTable)).toEqual([]);
    const stored = await findUserByEmail(testDatabase.database, "default", "ana@example.com");
    expect(await verifyPassword(NEW_PASSWORD, stored!.passwordHash!)).toBe(true);
    expect(await verifyPassword(ADMIN.password, stored!.passwordHash!)).toBe(false);
  });

  it("says when there is no such user, and suggests the closest email", async () => {
    await createAdmin(testDatabase.database, ADMIN);

    const attempt = resetPassword(testDatabase.database, "ana@exmaple.com", NEW_PASSWORD);

    await expect(attempt).rejects.toThrow(UserNotFoundError);
    await expect(attempt).rejects.toThrow(
      "There is no user with the email ana@exmaple.com. Did you mean ana@example.com?",
    );
  });
});
