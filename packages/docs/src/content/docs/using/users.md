---
title: People and permissions
description: Inviting people, choosing what they can do, and keeping your account safe.
since: "0.1"
sidebar:
  label: People and permissions
---

## Who can do what

What someone can do in Lintel comes from their **role**. Lintel only shows people the
buttons and sections they can use, so an Author sees **Publish** on their own posts but not
on anyone else's.

Every site has five roles:

| Role       | What they can do                                                                  |
| ---------- | --------------------------------------------------------------------------------- |
| **Owner**  | Everything, including managing other owners. The person who set Lintel up is one. |
| **Admin**  | Everything except changing owners.                                                |
| **Editor** | Write, edit and publish all content; manage media, menus and tags.                |
| **Author** | See all content, but only change, publish or delete what they wrote themselves.   |
| **Viewer** | Look at content and media without changing anything.                              |

If none of these fits, an admin can make a **custom role** under **Users → Roles → New
role**. Each permission is a switch with a plain description, grouped like the sections of
the admin. Plugins you switch on (such as the online shop) add their own group. You can only
give a role things you can do yourself.

## Inviting someone

1. Go to **Users** and choose **Invite someone**.
2. Type their email address and pick a role. **Editor** is chosen for you.
3. Choose **Send invitation**.

They get an email with a link that works for 7 days. Opening it asks for their name and a
password, then signs them in. If the email doesn't arrive, Lintel also shows you the link
once, so you can send it yourself.

Invitations waiting to be accepted are listed at the top of **Users**. **Resend** sends a new
link (the old one stops working); the **×** cancels it.

## Changing someone's role, or stopping them signing in

Select a person on the **Users** screen to see their details.

- **Change role** takes effect straight away.
- **Deactivate** signs them out everywhere and stops them signing in, but keeps their
  account and their work. **Reactivate** undoes it.
- **Remove** deletes their account for good. Lintel first asks who should become the author
  of their pages, posts and uploads.

To keep the site manageable, there is always at least one active Owner: the last one can't
be demoted, deactivated or removed. Only owners can change another owner.

## Your account

Select your name at the bottom of the sidebar to open **Your account**. There you can change
your name and picture, your email (we send a link to the new address first), and your
password. Changing your password signs you out on your other devices.

**Where you're signed in** lists every browser using your account. **Sign out other
devices** is the thing to do if you've lost a laptop.

## Two-factor authentication

With two-factor on, signing in asks for a six-digit code from an app on your phone after
your password, so a stolen password isn't enough.

1. On **Your account**, under **Two-factor authentication**, choose **Set up**.
2. Scan the QR code with an authenticator app (or type the key it shows).
3. Type the code the app shows, and choose **Turn on**.
4. Save the **recovery codes**. Each one signs you in once if you lose your phone.

An admin can require two-factor for a role (open the role and switch on **Require two-factor
authentication**). People with that role are asked to turn it on before they can do
anything else.

## Passkeys

A passkey lets you sign in with your fingerprint, face or device PIN instead of a password.
Add one under **Passkeys** on **Your account**, then choose **Sign in with a passkey** on the
sign-in screen. Your password keeps working too.

## Forgotten password

Choose **Forgot your password?** on the sign-in screen and type your email. If there's an
account with that address, you'll get a link that works once, for 30 minutes. Choosing a new
password signs you out on every device.

If email isn't set up for your site, an admin can find the link under **Settings → Email
outbox**, or whoever installed Lintel can reset it with one command (see
[Installing Lintel](/building/install/#more-commands)).

## The security log

**Users → Security log** lists sign-ins, failed sign-ins and every change to people,
roles, two-factor, passkeys and API tokens. Choose **Download CSV** to keep a copy or to send
it to someone checking your security.

## Staying signed in

You stay signed in on each browser until you sign out. If you see **You've been signed
out**, sign in again; whatever you were doing is still on the screen.
