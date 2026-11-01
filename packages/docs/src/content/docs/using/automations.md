---
title: Automations
description: Let Lintel tell people, ask for approval and connect to other services for you.
since: "0.1"
---

Automations do routine work for you. Each one says **when** it runs and **what happens**:
"When a blog post is published, send an email to the team". You build them by choosing
from lists; there is no code to write.

Automations are an optional feature, switched on during setup on the **Choose your
features** step. If you don't see **Automations** in the sidebar, ask whoever set up Lintel.

## Starting from an example

Open **Automations** and choose one of the examples under **Start from an example**:

- **Notify me when a form is submitted** emails you the answers.
- **Post new blog posts to Slack** shares each new post in a channel. Paste the address
  Slack gives you for an "incoming webhook" into the step.
- **Require approval for pages** makes pages wait for a review before they go live (see
  [Content approval](#content-approval)).
- **Call my server when content changes** is for developers.

The example opens in the builder so you can adjust it. Press **Save** when it looks right.

## Building your own

Press **New automation**. The builder reads from top to bottom.

1. The first card says when the automation starts. Press the pencil to change it:
   **When something happens** (an entry is published, a file is uploaded, a form is
   submitted…), **On a schedule** (every day at 9:00, every Monday…), or **When I press
   Run**. For content you can choose which collections it applies to.
2. Press **+** to add a step. Steps run one after another:
   - **Send an email** or **Notify people in Lintel** (the bell at the top right).
   - **Change a field**, **Publish the entry** or **Unpublish the entry**.
   - **Wait** for some minutes, hours or days.
   - **Only continue if…** checks something, such as "the title contains News", and
     splits into **If yes** and **If not**.
   - **Ask for approval** waits until someone with a role says yes or asks for changes.
   - **Run another automation** and **Call a web address**.
3. Each card describes its step in plain English, so you can read the whole automation
   back. Use the arrows to reorder steps and the bin to remove one.

### Filling in details

Messages can include details of what happened. Type them in double curly brackets:

| Write                         | To show                        |
| ----------------------------- | ------------------------------ |
| `{{entry.title}}`             | The entry's title              |
| `{{entry.url}}`               | Where it is on your site       |
| `{{entry.fields.summary}}`    | Any field, by its handle       |
| `{{actor.name}}`              | The person who made the change |
| `{{form.name}}`               | The form that was filled in    |
| `{{submission.fields.email}}` | An answer from the form        |

Anything that doesn't exist is simply left out.

## Trying it out

After saving, press **Test run**. It runs once with example data, which you can change
first. Nothing on your site changes: emails and notifications go only to you, waits are
skipped and approvals count as approved.

## Seeing what happened

Open the **History** tab. Every run is listed with how it went: **Done**, **Waiting**,
**Failed** or **Stopped**. Open one to see each step and what it did. If a step can't reach
another service, Lintel tries again a few times over the next hour before giving up. A run
that is waiting can be stopped with **Stop this run**.

To pause an automation, switch it **Off** and save.

## Content approval

Some content should be checked before it goes live. Open **Automations**, then **Content
approval**, and switch on **Require approval before publishing** for a collection. Choose
who reviews it, and whether it is published as soon as it's approved.

For authors, the entry's details panel then has a **Review** section:

1. Write the entry, then press **Submit for review**. You can add a note for the reviewer.
2. Reviewers are notified under the bell. They open the entry and press **Approve**, or
   **Request changes** with a comment saying what to change.
3. If changes are requested, you're told what to change. Make them and press **Submit
   again**.
4. Once approved, the entry is published (or can be). If you change it afterwards, it needs
   another review.

People who can do everything on the site can still publish straight away, so nothing ever
gets stuck. See [Publishing and scheduling](/using/publishing/) for publishing itself.
