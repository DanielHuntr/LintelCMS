import type { DatabaseOrTransaction } from "../../database/client.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import type { Address } from "./address.schema.js";
import {
  type CustomerTotals,
  findCustomerRow,
  findOrCreateCustomerRow,
  listCustomerRows,
  sumCustomerOrders,
  updateCustomerRow,
} from "./customers.repository.js";
import type { Customer, ListCustomersQuery, UpdateCustomerRequest } from "./customers.schema.js";
import type { CustomerRow } from "./customers.table.js";

/** Customers are made by orders; staff can add a name, phone number and private note. */

const MAX_REMEMBERED_ADDRESSES = 10;

/**
 * The customer behind an order, found by email (case doesn't matter). Their delivery
 * address goes to the front of their list, without a duplicate.
 */
export async function recordCustomerForOrder(
  database: DatabaseOrTransaction,
  email: string,
  address: Address,
): Promise<CustomerRow> {
  const customer = await findOrCreateCustomerRow(database, email.toLowerCase(), address.name);
  const others = customer.addresses.filter((saved) => !sameAddress(saved, address));
  await updateCustomerRow(database, customer.id, {
    name: customer.name || address.name,
    phone: customer.phone || address.phone,
    addresses: [address, ...others].slice(0, MAX_REMEMBERED_ADDRESSES),
  });
  return customer;
}

export async function listCustomers(
  database: DatabaseOrTransaction,
  query: ListCustomersQuery,
): Promise<{ items: Customer[]; total: number }> {
  const { rows, total } = await listCustomerRows(database, query.search, query);
  const totals = await sumCustomerOrders(
    database,
    rows.map((row) => row.id),
  );
  return { items: rows.map((row) => describeCustomer(row, totals.get(row.id))), total };
}

export async function findCustomer(
  database: DatabaseOrTransaction,
  customerId: string,
): Promise<Customer> {
  const row = await findCustomerRow(database, customerId);
  if (!row) {
    throw new ShopRecordNotFoundError("customer");
  }
  const totals = await sumCustomerOrders(database, [row.id]);
  return describeCustomer(row, totals.get(row.id));
}

export async function updateCustomer(
  database: DatabaseOrTransaction,
  customerId: string,
  changes: UpdateCustomerRequest,
): Promise<Customer> {
  await findCustomer(database, customerId);
  await updateCustomerRow(database, customerId, changes);
  return findCustomer(database, customerId);
}

function describeCustomer(row: CustomerRow, totals: CustomerTotals | undefined): Customer {
  // An imported customer has been one since their first order in the old shop, not since
  // the day of the import.
  const firstOrderAt = totals?.firstArchivedOrderAt;
  const customerSince = firstOrderAt && firstOrderAt < row.createdAt ? firstOrderAt : row.createdAt;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    note: row.note,
    addresses: row.addresses,
    orderCount: totals?.orderCount ?? 0,
    totalSpent: totals?.totalSpent ?? [],
    createdAt: row.createdAt.toISOString(),
    customerSince: customerSince.toISOString(),
  };
}

function sameAddress(first: Address, second: Address): boolean {
  const key = (address: Address) =>
    [address.name, address.line1, address.line2, address.city, address.postalCode, address.country]
      .map((part) => part.trim().toLowerCase())
      .join("|");
  return key(first) === key(second);
}
