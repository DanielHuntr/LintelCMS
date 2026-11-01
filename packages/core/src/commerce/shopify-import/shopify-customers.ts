import type { Address } from "../customers/address.schema.js";
import type { CsvTable } from "./csv.js";
import { cell, splitList } from "./shopify-products.js";

/**
 * Reads Shopify's customers export (Customers → Export). Both the current column names
 * ("Default Address Address1") and the older ones ("Address1") are understood. Shopify never
 * exports passwords, and Lintel doesn't ask for them: customers are records of who bought.
 */
export interface ShopifyCustomer {
  email: string;
  name: string;
  phone: string;
  address: Omit<Address, "country"> & { country: string };
  note: string;
  tags: string[];
}

export const CUSTOMER_COLUMN_FIELDS: Record<string, string> = {
  "First Name": "name",
  "Last Name": "name",
  Email: "email",
  Phone: "phone",
  "Default Address Phone": "phone",
  Company: "address",
  Address1: "address",
  Address2: "address",
  City: "address",
  "Province Code": "address",
  "Country Code": "address",
  Zip: "address",
  "Default Address Company": "address",
  "Default Address Address1": "address",
  "Default Address Address2": "address",
  "Default Address City": "address",
  "Default Address Province Code": "address",
  "Default Address Country Code": "address",
  "Default Address Zip": "address",
  Note: "note",
  Tags: "note",
};

export function readShopifyCustomers(table: CsvTable): ShopifyCustomer[] {
  return table.rows
    .map((row) => {
      const name = [cell(row, "First Name"), cell(row, "Last Name")].filter(Boolean).join(" ");
      return {
        email: cell(row, "Email").toLowerCase(),
        name,
        phone: cell(row, "Phone", "Default Address Phone"),
        address: {
          name,
          company: cell(row, "Default Address Company", "Company"),
          line1: cell(row, "Default Address Address1", "Address1"),
          line2: cell(row, "Default Address Address2", "Address2"),
          city: cell(row, "Default Address City", "City"),
          region: cell(row, "Default Address Province Code", "Province Code"),
          postalCode: cell(row, "Default Address Zip", "Zip").replace(/^'/, ""),
          country: cell(row, "Default Address Country Code", "Country Code").toUpperCase(),
          phone: cell(row, "Default Address Phone", "Phone"),
        },
        note: cell(row, "Note"),
        tags: splitList(cell(row, "Tags")),
      };
    })
    .filter((customer) => customer.email !== "" || customer.name !== "");
}
