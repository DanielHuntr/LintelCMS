---
title: Selling with Lintel
description: Setting up the shop, adding products, taking payments with Stripe, and handling orders.
since: "0.3"
sidebar:
  label: Selling
---

Lintel has a built-in online shop. It appears as **Commerce** in the sidebar once **Online
shop** is switched on, either in the setup wizard or later under **Settings → Plugins**.

## Getting ready to sell

The Shop's home page lists four things to do before your first sale. Each one links to the
right screen, and gets a tick once it's done:

1. **Choose where you sell.** Under **Settings → Markets**, add your home country and its
   currency. This first market is your _primary_ market: you set prices in its currency.
   Add more markets for other countries, each with its own currency. Lintel works out their
   prices from yours with an exchange rate you give, and rounds them (to a whole number, or
   to .99) unless you set a price yourself.
2. **Set your delivery prices.** Under **Settings → Delivery**, add an area (such as "UK")
   with its countries, then the prices customers can choose from: the same for every order,
   going up with weight, or free over a certain amount.
3. **Connect Stripe.** See below.
4. **Add your first product.**

## Products

**Products → Add product** opens the editor:

- **Name, description and photos.** The first photo is the one shown in lists.
- **Options** are the choices a customer makes, such as Size (S, M, L) and Colour (Blue,
  Red). Lintel makes one _variant_ for each combination. Leave options empty if the product
  comes one way.
- **Price and stock** for each variant: the price in your shop's currency, an optional "was"
  price for sales, and how many you have. Turn off **Count stock** for things that never run
  out, such as digital downloads.
- **Status.** _Draft_ products are only visible to you; _On sale_ ones are on your site;
  _Archived_ ones are hidden but kept for your records.

Lintel never sells more than you have. While a customer is paying, their items are held for
them. If they give up, the items go back on sale after a short while.

## Taking payments with Stripe

Payments go through [Stripe](https://stripe.com). Card numbers are typed into Stripe's own
page or form and never reach your site, which keeps the paperwork for card security to a
minimum.

**Settings → Payments** walks you through connecting Stripe in four steps:

1. Make a Stripe account (or sign in to yours).
2. Copy your **publishable key** and **secret key** from Stripe's API keys page into Lintel.
   Start with test keys (they begin `pk_test_` and `sk_test_`), so no real money changes
   hands while you try things out.
3. Tell Stripe about payments: add a webhook endpoint in Stripe with the address Lintel shows
   you and the events it lists, then paste the endpoint's **signing secret** into Lintel.
   This is how Lintel learns that an order has been paid.
4. Press **Check connection**.

When you're ready to sell for real, repeat steps 2 and 3 with your live keys.

:::note
If whoever runs your server has set the Stripe keys there, the Payments screen says so and
the keys can't be changed in the admin.
:::

You can also choose how customers pay: on **Stripe's checkout page**, or with a **payment
form on your own site**.

## Tax

Under **Settings → Tax**, choose how tax is worked out:

- **Automatically, with Stripe Tax.** Stripe works out the right tax for each customer's
  address. Stripe charges a small fee for this, and it has to be switched on in your Stripe
  account.
- **With my own rates.** Set a rate for each country, such as 20% VAT for the UK. Countries
  without a rate pay no tax.

Each market says whether its prices already include tax (usual in the UK and Europe) or have
tax added at checkout (usual in the US and Canada).

## Orders

Every paid order appears under **Orders**, newest first. Use **To send**, **Sent** and
**Refunded** to narrow the list.

An order shows what was bought, where it's going, how it was paid, and its history. From
there you can:

- **Mark as sent.** Choose what went in the parcel, add the delivery company and tracking
  number, and Lintel emails the customer to say it's on its way. You can send an order in
  more than one parcel.
- **Refund.** Refund chosen items (and put them back in stock), or any amount up to what
  was paid. The money goes back to the customer's card through Stripe.
- **Cancel** an order that hasn't been sent, refunding what's left.
- **Add a note** for the people who run the shop. Customers never see notes.

## Customers

Everyone who places an order is added to **Customers**, with their orders, how much they've
spent and their addresses. You can keep a private note on each one.

## Order emails

Customers get an email when they order, when their order is sent, and when they're refunded.
Until your site has an email service set up, these emails are kept under **Settings → Order
emails** instead of being sent, so you can see exactly what customers would get.

## The dashboard

With the shop switched on, the dashboard shows your sales over the last 30 days and how many
orders are waiting to be sent.
