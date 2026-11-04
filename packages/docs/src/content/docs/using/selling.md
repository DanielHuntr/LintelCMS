---
title: Selling with Lintel
description: Setting up the shop, adding products, discounts, taking payments with Stripe, PayPal or Mollie, and handling orders.
since: "0.3"
sidebar:
  label: Selling
---

Lintel has a built-in online shop. It appears as **Shop** in the sidebar once **Online
shop** is switched on, either in the setup wizard or later under **Settings → Plugins**.

## Getting ready to sell

The Shop's home page lists four things to do before your first sale. Each one links to the
right screen, and gets a tick once it's done:

1. **Choose where you sell.** Under **Settings → Where you sell**, add your home country and its
   currency. This first region is your _main_ region: you set prices in its currency.
   Add more regions for other countries, each with its own currency. Lintel works out their
   prices from yours with an exchange rate you give, and rounds them (to a whole number, or
   to .99) unless you set a price yourself.
2. **Set your delivery prices.** Under **Settings → Delivery**, add an area (such as "UK")
   with its countries, then the prices customers can choose from: the same for every order,
   going up with weight, or free over a certain amount.
3. **Connect a payment provider.** Stripe, PayPal or Mollie: see below.
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

Moving from Shopify? Lintel can bring your products, customers and past orders across from
Shopify's export files: see [Moving from Shopify](/using/moving-from-shopify/).

Lintel never sells more than you have. While a customer is paying, their items are held for
them. If they give up, the items go back on sale after a short while.

## Discounts

**Discounts** has two kinds:

- **Codes** customers type in their cart, such as `SUMMER20`. Codes don't care about
  capital letters.
- **Automatic discounts**, which apply by themselves to every cart that qualifies, such as
  free delivery on orders of £75 or more.

Each discount gives one of four things: a **percentage off**, an **amount off** (set in each
of your currencies; leave one empty and that region isn't offered it), **free delivery**, or
**buy X, get Y**, such as buy 2, get 1 free. With buy X get Y, the cheapest items in each
group are the ones discounted.

A discount can be for **everything**, **some products** or **some collections**, and can
need a **minimum spend** or a **minimum number of items** (counting only the items it's
for). You can give it **start and end dates**, a **total number of uses**, and limit it to
**once per customer** (by email address).

Make collections in **Shop → Collections**: give one a title and tick its products, or tick
a product's collections at the bottom of its editor. Collections that pick products by rules
(the Shopify import makes these from tags) keep their rules; you can change their title and
description.

At the top of the editor, a one-line summary says what you've set up, in plain words, such
as "20% off Summer Edit, orders of £50 or more, until 31 Aug". Check it before you save.

### How discounts add up

- One code per order.
- Automatic discounts apply by themselves: the one that saves the most on the items, plus a
  free-delivery one if there is one.
- A code adds to automatic discounts, unless one of them has **Can be combined with other
  discounts** switched off. Then only the bigger saving applies, and the customer is told
  why.

### What customers see

If a code can't be used, the customer is told why, in plain words: "This code has expired",
"You've already used this code", "Spend £50.00 or more to use this code". A code that only
needs a bigger order stays in the cart and starts working once the cart qualifies.

When a code has a limited number of uses, each checkout holds one use while the customer
pays, so two customers can't both take the last one. If a customer gives up, the use is
freed again.

Discounts are shown in the cart's totals and on the order, and tax is worked out on what the
customer actually pays. When you refund an item, the customer gets back what they paid for
it after the discount.

## Trying your shop

Before you open, place a test order. You don't need a payment account, and it works on your
own computer.

1. In **Shop**, or in **Shop → Settings → Payments**, choose **Place a test order**. Your website
   opens in a new tab, with a bar at the bottom saying no money is taken.
2. Buy something as a shopper would. Discount codes, delivery and tax all work.
3. On the test payment page, choose **Pay (test)**, or **Make the payment fail** to see what
   happens then.
4. Choose **See it in your orders** in the bar. The order has a **Test** badge.

Only your browser is in test mode, for two hours at most, and your shoppers never see it.
Choose **End test** in the bar to stop sooner.

Test orders take stock and send emails, marked as a test, to the address you typed. They don't
count as sales and automations don't run for them. When you've finished, choose **Delete test
orders** on the Orders page. The stock goes back.

Orders paid with your payment provider's test keys or sandbox are test orders too. Their refunds
still go through the provider.

## Taking payments

Lintel can take payments through [Stripe](https://stripe.com), [PayPal](https://paypal.com)
or [Mollie](https://www.mollie.com). Customers always pay on the provider's own secure page
(or, with Stripe, a payment form that Stripe runs inside your page), so card numbers never
reach your site. That keeps the paperwork for card security to a minimum.

Each region uses one provider. Stripe is used unless you choose another: at the top of
**Settings → Payments**, pick a provider for each region. Only connected providers can be
chosen. You might, for example, use Stripe in the UK and Mollie in the Netherlands, where
many people pay with iDEAL.

An order is only made once the provider confirms the payment, in a way that can't be faked.
Coming back to your site's "thank you" page proves nothing by itself.

### Stripe

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

While your site is on your own computer, Stripe can't reach it, so there's no webhook step.
Lintel checks with Stripe for payments every few seconds instead, and test payments work with
nothing else to set up. Add the webhook once your site is live.

### PayPal

Choose **PayPal** in **Settings → Payments** and follow the three steps:

1. In PayPal's developer dashboard, sign in with your PayPal business account and create an
   **app**. Start on the **Sandbox** tab to test without real money.
2. In your app, add a **webhook** with the address Lintel shows you, and tick the events it
   lists. PayPal then shows the webhook's **ID**.
3. Paste the app's **Client ID** and **Secret** and the **webhook ID** into Lintel, choose
   Sandbox or Live, and press **Save and check**.

Customers approve the payment on PayPal's page; Lintel then takes the money and makes the
order. If a customer approves a payment after their checkout has run out, they aren't
charged.

### Mollie

Choose **Mollie** in **Settings → Payments**, then copy your **API key** from Mollie's
dashboard (**Developers → API keys**) and press **Save and check**. Use the test key (it
begins `test_`) first. There's no webhook to set up: each payment tells Mollie where to
report back.

:::note
Mollie can only report back once your site is online. While Lintel runs on your own
computer, Mollie payments can be tried, but no orders are made from them.
:::

## Tax

Under **Settings → Tax**, choose how tax is worked out:

- **Automatically, with Stripe Tax.** Stripe works out the right tax for each customer's
  address. Stripe charges a small fee for this, and it has to be switched on in your Stripe
  account.
- **With my own rates.** Set a rate for each country, such as 20% VAT for the UK. Countries
  without a rate pay no tax.

Each region says whether its prices already include tax (usual in the UK and Europe) or have
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
  was paid. The money goes back to the customer the way they paid: through Stripe, PayPal or
  Mollie.
- **Cancel** an order that hasn't been sent, refunding what's left.
- **Add a note** for the people who run the shop. Customers never see notes.

## Customers

Everyone who places an order is added to **Customers**, with their orders, how much they've
spent and their addresses. You can keep a private note on each one. Customers brought over
from Shopify also show their **orders before the move**.

## Order emails

Customers get an email when they order (listing any discount codes they used), when their
order is sent, and when they're refunded. They go out with the rest of Lintel's email, and
replies go to your shop's support address. Until your site has an email service set up, these
emails are kept in **Users → Security log → Emails sent** instead of being sent, so you can see exactly
what customers would get.

Automations can react to orders too: **An order is paid for**, **An order is sent** and **An
order is refunded** are under Shop when you choose what starts an automation.

## The dashboard

With the shop switched on, the dashboard has a **Sales** widget: your sales over the last 30
days and how many orders are waiting to be sent. Like every widget, you can move, resize or
remove it with **Edit dashboard**.
