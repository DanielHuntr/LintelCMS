import { deleteSubmissionsAndFiles } from "../forms/submissions.service.js";
import type { PersonalDataHookContext, PersonalDataHooks } from "./personal-data-declaration.js";
import {
  anonymiseArchivedOrders,
  anonymiseOrders,
  anonymiseSecurityEvents,
  deleteCartsAndCheckouts,
  deleteCustomers,
  deleteInvitations,
  listLinesOfOrders,
  listMatchingArchivedOrders,
  listMatchingCarts,
  listMatchingCustomers,
  listMatchingInvitations,
  listMatchingOrders,
  listMatchingSecurityEvents,
  listMatchingSubmissions,
  listMatchingUnfinishedCheckouts,
  listMatchingUsers,
  listNotesOnSubmissions,
} from "./personal-data.repository.js";
import type { PersonalDataSource, PrivacyContext } from "./personal-data-sources.js";

/**
 * The personal data in Lintel's own tables, kind by kind, each with how it is found, what an
 * export holds and what erasing does. The rules for erasing are explained in
 * docs/decisions/0062-privacy-tools.md: most things are deleted; orders are kept for tax
 * records with the person taken out; staff accounts are removed in Users, not here.
 */
export function coreSources(context: PrivacyContext): PersonalDataSource[] {
  return [
    accountsSource(),
    formEntriesSource(context),
    customersSource(),
    ordersSource(),
    cartsSource(),
    securityLogSource(),
    ...unsearchedSources(),
  ];
}

const iso = (date: Date | null) => date?.toISOString() ?? null;

function source(
  fields: Omit<PersonalDataSource, "from" | "notSearchableReason" | "pluginId"> & {
    pluginId?: string;
  },
): PersonalDataSource {
  return { from: "core", notSearchableReason: null, pluginId: null, ...fields };
}

function accountsSource(): PersonalDataSource {
  const hooks: PersonalDataHooks = {
    async find({ database, tenantId, person }) {
      const [users, invitations] = await Promise.all([
        listMatchingUsers(database, tenantId, person),
        listMatchingInvitations(database, tenantId, person),
      ]);
      return [
        ...users.map((user) => ({
          id: user.id,
          summary: `Admin account: ${user.name}`,
          date: iso(user.createdAt),
        })),
        ...invitations.map((invitation) => ({
          id: invitation.id,
          summary: "Invitation to the admin",
          date: iso(invitation.createdAt),
        })),
      ];
    },
    async export({ database, tenantId, person }) {
      const [users, invitations] = await Promise.all([
        listMatchingUsers(database, tenantId, person),
        listMatchingInvitations(database, tenantId, person),
      ]);
      return [
        ...users.map((user) => ({
          kind: "Admin account",
          name: user.name,
          email: user.email,
          createdAt: iso(user.createdAt),
        })),
        ...invitations.map((invitation) => ({
          kind: "Invitation",
          email: invitation.email,
          createdAt: iso(invitation.createdAt),
        })),
      ];
    },
    async erase({ database, tenantId, person }) {
      const [users, invitations] = await Promise.all([
        listMatchingUsers(database, tenantId, person),
        listMatchingInvitations(database, tenantId, person),
      ]);
      const deleted = await deleteInvitations(
        database,
        invitations.map((invitation) => invitation.id),
      );
      return {
        deleted,
        kept: users.length,
        explanation:
          users.length > 0
            ? "Admin accounts aren't removed here. Remove the person in Users, so their work keeps an author."
            : undefined,
      };
    },
  };
  return source({
    id: "accounts",
    name: "Admin accounts",
    description: "Name, email and sign-in details of people who use this admin.",
    tables: [
      { name: "users", columns: ["name", "email"] },
      { name: "invitations", columns: ["email"] },
      { name: "sessions", columns: ["user_agent"] },
    ],
    erasure: "Invitations are deleted. Accounts are removed in Users.",
    hooks,
  });
}

function formEntriesSource(context: PrivacyContext): PersonalDataSource {
  const hooks: PersonalDataHooks = {
    async find({ database, tenantId, person }) {
      const rows = await listMatchingSubmissions(database, tenantId, person);
      return rows.map(({ submission, formName }) => ({
        id: submission.id,
        summary: `${formName} entry`,
        date: iso(submission.createdAt),
      }));
    },
    async export({ database, tenantId, person }) {
      const rows = await listMatchingSubmissions(database, tenantId, person);
      const notes = await listNotesOnSubmissions(
        database,
        rows.map(({ submission }) => submission.id),
      );
      return rows.map(({ submission, formName }) => ({
        form: formName,
        sentAt: iso(submission.createdAt),
        page: submission.sourceUrl,
        answers: submission.values,
        consents: submission.consents,
        notes: notes
          .filter((note) => note.submissionId === submission.id)
          .map((note) => ({ note: note.body, writtenAt: iso(note.createdAt) })),
      }));
    },
    async erase({ database, tenantId, person }) {
      const rows = await listMatchingSubmissions(database, tenantId, person);
      const deleted = await deleteSubmissionsAndFiles(
        { ...context.forms(), database },
        rows.map(({ submission }) => submission.id),
      );
      return { deleted };
    },
  };
  return source({
    id: "form-entries",
    name: "Form entries",
    description:
      "What people type into the site's forms, any files they send, the page they sent it from and the consent they gave.",
    pluginId: "forms",
    tables: [
      { name: "form_submissions", columns: ["values", "submitter_email", "consents"] },
      { name: "form_submission_notes", columns: ["body"] },
    ],
    erasure: "Deleted, with the files they sent and your notes on them.",
    hooks,
  });
}

function customersSource(): PersonalDataSource {
  const hooks: PersonalDataHooks = {
    async find({ database, tenantId, person }) {
      const rows = await listMatchingCustomers(database, tenantId, person);
      return rows.map((row) => ({
        id: row.id,
        summary: `Customer: ${row.name || row.email}`,
        date: iso(row.createdAt),
      }));
    },
    async export({ database, tenantId, person }) {
      const rows = await listMatchingCustomers(database, tenantId, person);
      return rows.map((row) => ({
        name: row.name,
        email: row.email,
        phone: row.phone,
        addresses: row.addresses,
        note: row.note,
        createdAt: iso(row.createdAt),
      }));
    },
    async erase({ database, tenantId, person }) {
      const rows = await listMatchingCustomers(database, tenantId, person);
      return {
        deleted: await deleteCustomers(
          database,
          rows.map((row) => row.id),
        ),
      };
    },
  };
  return source({
    id: "shop-customers",
    name: "Shop customers",
    description: "Name, email, phone and saved addresses of people who buy.",
    pluginId: "commerce",
    tables: [{ name: "shop_customers", columns: ["name", "email", "phone", "addresses", "note"] }],
    erasure: "Deleted.",
    hooks,
  });
}

async function findOrders({ database, tenantId, person }: PersonalDataHookContext) {
  const [orders, archived] = await Promise.all([
    listMatchingOrders(database, tenantId, person),
    listMatchingArchivedOrders(database, tenantId, person),
  ]);
  return { orders, archived };
}

function ordersSource(): PersonalDataSource {
  const hooks: PersonalDataHooks = {
    async find(context) {
      const { orders, archived } = await findOrders(context);
      return [
        ...orders.map((order) => ({
          id: order.id,
          summary: `Order ${order.name}`,
          date: iso(order.createdAt),
        })),
        ...archived.map((order) => ({
          id: order.id,
          summary: `Order ${order.name} (from before the move)`,
          date: iso(order.placedAt),
        })),
      ];
    },
    async export(context) {
      const { orders, archived } = await findOrders(context);
      const lines = await listLinesOfOrders(
        context.database,
        orders.map((order) => order.id),
      );
      return [
        ...orders.map((order) => ({
          order: order.name,
          placedAt: iso(order.createdAt),
          email: order.email,
          deliveryAddress: order.shippingAddress,
          currency: order.currency,
          total: order.totalAmount / 100,
          items: lines
            .filter((line) => line.orderId === order.id)
            .map((line) => ({
              product: line.productTitle,
              option: line.variantTitle,
              quantity: line.quantity,
            })),
        })),
        ...archived.map((order) => ({
          order: order.name,
          placedAt: iso(order.placedAt),
          email: order.email,
          deliveryAddress: order.shippingAddress,
          currency: order.currency,
          total: order.totalAmount / 100,
          items: order.lines,
        })),
      ];
    },
    async erase(context) {
      const { orders, archived } = await findOrders(context);
      const anonymised =
        (await anonymiseOrders(context.database, orders)) +
        (await anonymiseArchivedOrders(context.database, archived));
      return {
        deleted: 0,
        anonymised,
        explanation:
          anonymised > 0
            ? "Orders stay for your tax records, with the name, email, address and phone removed. What was bought, the amounts and the country stay."
            : undefined,
      };
    },
  };
  return source({
    id: "shop-orders",
    name: "Orders",
    description: "Email and delivery address on each order, and on the checkout it came from.",
    pluginId: "commerce",
    tables: [
      { name: "shop_orders", columns: ["email", "shipping_address"] },
      { name: "shop_checkouts", columns: ["email", "shipping_address"] },
      { name: "shop_archived_orders", columns: ["email", "shipping_address"] },
      { name: "shop_discount_redemptions", columns: ["email"] },
    ],
    erasure:
      "Kept for tax records with the name, email, address and phone removed. Amounts and items stay.",
    hooks,
  });
}

function cartsSource(): PersonalDataSource {
  const find = async ({ database, tenantId, person }: PersonalDataHookContext) => {
    const [carts, checkouts] = await Promise.all([
      listMatchingCarts(database, tenantId, person),
      listMatchingUnfinishedCheckouts(database, tenantId, person),
    ]);
    return { carts, checkouts };
  };
  const hooks: PersonalDataHooks = {
    async find(context) {
      const { carts, checkouts } = await find(context);
      return [
        ...carts.map((cart) => ({ id: cart.id, summary: "Basket", date: iso(cart.updatedAt) })),
        ...checkouts.map((checkout) => ({
          id: checkout.id,
          summary: "Checkout that wasn't paid",
          date: iso(checkout.createdAt),
        })),
      ];
    },
    async export(context) {
      const { carts, checkouts } = await find(context);
      return [
        ...carts.map((cart) => ({
          kind: "Basket",
          email: cart.email,
          deliveryAddress: cart.shippingAddress,
          updatedAt: iso(cart.updatedAt),
        })),
        ...checkouts.map((checkout) => ({
          kind: "Unpaid checkout",
          email: checkout.email,
          deliveryAddress: checkout.shippingAddress,
          createdAt: iso(checkout.createdAt),
        })),
      ];
    },
    async erase(context) {
      const { carts, checkouts } = await find(context);
      const deleted = await deleteCartsAndCheckouts(
        context.database,
        carts.map((cart) => cart.id),
        checkouts,
      );
      return { deleted };
    },
  };
  return source({
    id: "shop-carts",
    name: "Baskets",
    description: "The email and address typed into a basket or checkout that wasn't paid.",
    pluginId: "commerce",
    tables: [
      { name: "shop_carts", columns: ["email", "shipping_address"] },
      { name: "shop_checkouts", columns: ["email", "shipping_address"] },
    ],
    erasure: "Deleted.",
    hooks,
  });
}

function securityLogSource(): PersonalDataSource {
  const hooks: PersonalDataHooks = {
    async find({ database, tenantId, person }) {
      const rows = await listMatchingSecurityEvents(database, tenantId, person);
      return rows.map((row) => ({
        id: row.id,
        summary: `Security log: ${row.kind.replaceAll("-", " ")}`,
        date: iso(row.createdAt),
      }));
    },
    async export({ database, tenantId, person }) {
      const rows = await listMatchingSecurityEvents(database, tenantId, person);
      return rows.map((row) => ({
        event: row.kind,
        at: iso(row.createdAt),
        email: row.actorEmail,
        aboutName: row.subjectName,
        ipAddress: row.ipAddress,
        browser: row.userAgent,
      }));
    },
    async erase({ database, tenantId, person }) {
      const rows = await listMatchingSecurityEvents(database, tenantId, person);
      const anonymised = await anonymiseSecurityEvents(
        database,
        rows.map((row) => row.id),
      );
      return {
        deleted: 0,
        anonymised,
        explanation:
          anonymised > 0
            ? "Security log entries keep what happened and when, with the email, name, IP address and browser removed."
            : undefined,
      };
    },
  };
  return source({
    id: "security-log",
    name: "Security log",
    description: "Sign-ins and account changes, with the email, IP address and browser used.",
    tables: [
      {
        name: "security_events",
        columns: ["actor_email", "subject_name", "ip_address", "user_agent"],
      },
    ],
    erasure:
      "Kept as a record of what happened, with the email, name, IP address and browser removed.",
    hooks,
  });
}

/** Listed on the map so it's complete, but nothing in them can be searched for a person. */
function unsearchedSources(): PersonalDataSource[] {
  return [
    {
      id: "visitors",
      name: "Visitors",
      description:
        "Visit counts. No cookies, no IP addresses and no accounts are kept, so nothing here identifies anyone.",
      from: "core",
      pluginId: "analytics",
      tables: [],
      erasure: null,
      hooks: null,
      notSearchableReason: "Nothing here can identify a person.",
    },
    {
      id: "tests",
      name: "A/B tests",
      description:
        "Which version a visitor saw is kept in their own browser. The site only keeps totals.",
      from: "core",
      pluginId: "experiments",
      tables: [],
      erasure: null,
      hooks: null,
      notSearchableReason: "Nothing here can identify a person.",
    },
    {
      id: "backups",
      name: "Backups",
      description:
        "Each backup is a copy of everything above as it was then. Erased data leaves your backups as older ones are replaced.",
      from: "core",
      pluginId: null,
      tables: [],
      erasure: null,
      hooks: null,
      notSearchableReason:
        "Backups can't be changed. Erased data is gone from them once the backups made before the erasure are deleted.",
    },
  ];
}
