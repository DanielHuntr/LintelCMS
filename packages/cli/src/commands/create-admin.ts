import { z } from "zod";
import {
  createAdmin,
  EmailAlreadyUsedError,
  emailSchema,
  readNewPassword,
} from "@lintel/core/data-tools";
import { type Command, readArguments, withDatabase } from "../command.js";
import { CommandError } from "../terminal.js";

/**
 * Creates a Super admin. Most people never need this: the setup screen in the browser
 * creates the first admin. It is here for automated installs and for adding another admin
 * by hand. The password comes from LINTEL_ADMIN_PASSWORD, or is asked for (twice); never
 * as a flag, because flags end up in shell history and the process list.
 */
const usage = 'Usage: pnpm lintel create-admin --email <email> --name "<name>"';

const argumentsSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, { error: "Please give the admin a name" }),
});

export const createAdminCommand: Command = {
  name: "create-admin",
  summary: "Add a Super admin (the setup screen makes the first one)",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(
      argumentList,
      { email: { type: "string" }, name: { type: "string" } },
      usage,
    );
    const parsed = argumentsSchema.safeParse(values);
    if (!parsed.success) {
      throw new CommandError(`${z.prettifyError(parsed.error)}\n\n${usage}`);
    }
    const password = await readNewPassword("LINTEL_ADMIN_PASSWORD", "Nothing was created.");

    return withDatabase(async (activeDatabase) => {
      try {
        const admin = await createAdmin(activeDatabase.database, { ...parsed.data, password });
        terminal.say(`Created ${admin.name} <${admin.email}> as a Super admin.`);
        return 0;
      } catch (error) {
        if (error instanceof EmailAlreadyUsedError) {
          terminal.warn(error.message);
          return 1;
        }
        throw error;
      }
    });
  },
};
