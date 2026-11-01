/** The people on a seeded site. Both use the same password (see seed-site.ts). */
export const accounts = {
  owner: {
    email: "olivia@harbourbakery.test",
    name: "Olivia Owner",
    password: "a long and memorable password",
  },
  editor: {
    email: "eddie@harbourbakery.test",
    name: "Eddie Editor",
    password: "a long and memorable password",
  },
} as const;

export type AccountRole = keyof typeof accounts;
