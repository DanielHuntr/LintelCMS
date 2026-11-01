---
title: Moving from Shopify
description: Bringing your products, collections, customers and past orders over from Shopify's export files.
since: "0.6"
sidebar:
  label: Moving from Shopify
---

Lintel can bring your shop over from Shopify using the files Shopify's admin exports. You
don't need to give Lintel your Shopify password or any keys, and nothing changes in your
Shopify shop, so you can keep selling there until your new site is ready.

## Before you start

- Switch on **Online shop** and add your main **market** under **Commerce → Settings →
  Markets**, in the same currency as your Shopify shop. Shopify's files have prices but not
  their currency, so Lintel reads them in your shop's own currency.
- Export the files from your Shopify admin:
  - **Products → Export**, choosing "Plain CSV file". This is the only file you need.
  - **Customers → Export**, if you'd like your customers too.
  - **Orders → Export**, if you'd like your past orders as records.

## The four steps

Open **Commerce → Move from Shopify**.

1. **Choose the files.** Pick the products file, and the customers and orders files if you
   have them, then press **Read the files**.
2. **Check the preview and your choices.** Lintel shows how many products, variants,
   photos, customers and orders it found, the first few products, and **where everything
   goes**: each column in Shopify's files and what it becomes in Lintel. Columns Lintel has
   nowhere to keep are listed too. Then choose:
   - whether products come in **as they are in Shopify** (on sale, draft or archived) or
     **all as drafts**, so nothing appears on your site until you're ready;
   - whether to **download the product photos**;
   - whether to make **collections** from the file's Collection column, and which **tags**
     should each become a collection (such as all products tagged "summer");
   - whether to bring the **customers** and **past orders**;
   - where product pages live on your new site (usually `/products/`), so Lintel can
     suggest redirects.
3. **Try a dry run** (optional). Lintel checks everything and tells you what would happen,
   without saving or downloading anything.
4. **Start importing.** A progress bar shows how far it's got. Keep the page open; if you
   close it, the import pauses, and **Carry on importing** picks it up where it stopped.

## What comes across

| From Shopify      | In Lintel                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| Products          | Products with their description, brand, type, tags and search settings    |
| Options, variants | Options (such as Size and Colour) and a variant for each combination      |
| Prices            | Prices and "was" prices, in your shop's currency                          |
| Stock             | Stock at your first location, where Shopify counted it                    |
| Photos            | Downloaded into your media library                                        |
| Collection column | Collections with those products                                           |
| Tags you choose   | Collections that include every product with the tag, now and later        |
| Customers         | Customers with their name, email, phone, address and a note of their tags |
| Orders            | Past orders, kept as records on each customer                             |

Some things don't come across:

- **Passwords.** Shopify never exports them. Customers set up their accounts again.
- **Gift cards.** Lintel doesn't sell gift cards yet.
- **Photos stored somewhere other than Shopify.** Only photos on Shopify's own image
  servers are downloaded, and none larger than 20 MB. Anything skipped is listed in the
  report, and you can add it in the product editor afterwards.
- **Past orders as live orders.** They were paid in Shopify, so they're kept as records to
  look things up. They can't be refunded or marked as sent from Lintel, and they don't use
  up order numbers.

## Running it again

It's safe to import again, for example with a newer export. Anything already in your shop
is skipped: products and collections with the same address, customers with the same email,
and orders with the same number.

## The report

When the import finishes, the report shows what was brought in, what was skipped, and
anything that couldn't be, each with the reason in plain words.

It also lists **redirects** from your products' old Shopify addresses (`/products/…`) to
their new ones, wherever they differ, so old links and search results keep working. With the
SEO plugin switched on, they're waiting under **Settings → Redirects** as suggestions for you
to accept. You can also download them as a spreadsheet for your host.
