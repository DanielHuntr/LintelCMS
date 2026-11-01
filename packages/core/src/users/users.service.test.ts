import { describe, expect, it } from "vitest";
import { WeakPasswordError } from "../auth/auth.errors.js";
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
  requireStrongPassword,
  resetPassword,
  UserNotFoundError,
} from "./users.service.js";

const ADMIN = { email: "ana@example.com", name: "Ana Admin", password: "a long admin password" };

describe("createAdmin", () => {
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

  it("refuses an easily guessed password and creates nobody", async () => {
    const attempt = createAdmin(testDatabase.database, { ...ADMIN, password: "password1234" });

    await expect(attempt).rejects.toThrow(WeakPasswordError);
    expect(await findUserByEmail(testDatabase.database, "default", ADMIN.email)).toBeUndefined();
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

  it("refuses a new password built from the user's own name, keeping the old one", async () => {
    await createAdmin(testDatabase.database, ADMIN);

    const attempt = resetPassword(testDatabase.database, "ana@example.com", "ana admin 2024");

    await expect(attempt).rejects.toThrow("Leave out your name and email.");
    const stored = await findUserByEmail(testDatabase.database, "default", "ana@example.com");
    expect(await verifyPassword(ADMIN.password, stored!.passwordHash!)).toBe(true);
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

describe("requireStrongPassword", () => {
  it("passes a strong password and stops a weak one with a tip", () => {
    expect(() =>
      requireStrongPassword("maple-orbit-cactus-river-42", "Ana", "ana@example.com"),
    ).not.toThrow();
    expect(() => requireStrongPassword("sunshine1234", "Ana", "ana@example.com")).toThrow(
      "That password would be too easy to guess. It's close to a password many people use.",
    );
  });
});
