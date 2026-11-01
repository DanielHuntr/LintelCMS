import type { AccountForm } from "./accountDetails.js";
import { defaultPostgresForm, type PostgresForm } from "./postgresConnection.js";
import type { DatabaseKind, SiteType } from "./setup.api.js";
import type { SetupScreen, SetupStep } from "./setupRouting.js";

/**
 * Everything the setup screens collect. Nothing is sent until "Finish setup", so this is the
 * one place the answers live while people move between steps.
 */
export interface SetupAnswers {
  databaseKind: DatabaseKind;
  postgres: PostgresForm;
  account: AccountForm;
  siteName: string;
  siteType: SiteType;
}

/** Where the person is, and which steps they've been to (they can go back to those). */
export interface SetupProgress {
  screen: SetupScreen;
  visitedSteps: SetupStep[];
  completedSteps: SetupStep[];
}

export const emptyAnswers: SetupAnswers = {
  databaseKind: "built-in",
  postgres: defaultPostgresForm,
  account: { name: "", email: "", password: "", confirmPassword: "" },
  siteName: "",
  siteType: "business",
};

const storageKey = "lintel.setup";

interface StoredSetup {
  answers: SetupAnswers;
  progress: SetupProgress;
}

/**
 * Keeps the answers for this tab, so refreshing doesn't lose them. Passwords are never
 * written down: they stay in memory and are asked for again after a reload.
 */
export function rememberSetup(answers: SetupAnswers, progress: SetupProgress): void {
  const stored: StoredSetup = { answers: withoutPasswords(answers), progress };
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Private browsing can refuse storage. Setup still works; a refresh just starts again.
  }
}

/** What `rememberSetup` kept, or undefined when there is nothing (or it can't be read). */
export function rememberedSetup(): StoredSetup | undefined {
  try {
    const text = sessionStorage.getItem(storageKey);
    if (!text) return undefined;
    const stored = JSON.parse(text) as Partial<StoredSetup>;
    if (!stored.answers || !stored.progress) return undefined;
    return {
      answers: {
        ...emptyAnswers,
        ...stored.answers,
        postgres: { ...defaultPostgresForm, ...stored.answers.postgres, password: "" },
        account: { ...emptyAnswers.account, ...stored.answers.account },
      },
      progress: stored.progress,
    };
  } catch {
    return undefined;
  }
}

/** Once setup has finished there is nothing to come back to. */
export function forgetSetup(): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing was stored.
  }
}

function withoutPasswords(answers: SetupAnswers): SetupAnswers {
  return {
    ...answers,
    postgres: { ...answers.postgres, password: "" },
    account: { ...answers.account, password: "", confirmPassword: "" },
  };
}
