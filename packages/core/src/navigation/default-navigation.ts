import type { DatabaseOrTransaction } from "../database/client.js";
import { ensureNavigation } from "./navigation.service.js";

/** Every site starts with an empty main menu, made during setup, ready to fill in. */
export const mainMenu = { handle: "main", name: "Main menu", maxDepth: 2 };

export function ensureMainMenu(database: DatabaseOrTransaction): Promise<void> {
  return ensureNavigation(database, mainMenu);
}
