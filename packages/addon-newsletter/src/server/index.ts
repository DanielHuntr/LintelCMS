import { join } from "node:path";
import { defineBlock, definePlugin, packageFolder, text, textarea } from "@lintel/core/plugin";
import type { FetchFunction } from "./newsletter-providers.js";
import { newsletterRoutes } from "./newsletter.routes.js";
import { needsConsentTick, signUp } from "./newsletter.service.js";
import { newsletterConnectionTable } from "./newsletter.table.js";
import { defaultSignUpFormText, renderSignUpForm, signUpBlockTemplate } from "./signup-form.js";

/**
 * The server half of the Newsletter sign-up add-on: visitors join the site's Mailchimp or
 * Brevo list from a form on its pages. Every call to either service is made from here, so
 * visitors' browsers load nothing from them. The admin half (the Newsletter screen) is in
 * src/admin.
 */

/** The form the site's own Newsletter element usually sends. */
const NEWSLETTER_FORM = "newsletter";

export interface NewsletterAddonOptions {
  /** How it reaches Mailchimp and Brevo. Tests pass a stand-in. */
  fetch?: FetchFunction;
  /** Sign-ups one address may send in a minute. */
  signUpsPerMinute?: number;
}

export function createNewsletterAddon(options: NewsletterAddonOptions = {}) {
  const fetcher: FetchFunction = options.fetch ?? ((input, init) => fetch(input, init));

  return definePlugin({
    id: "newsletter",
    name: "Newsletter sign-up",
    description: "People join your Mailchimp or Brevo list from your website.",
    version: "0.1.0",

    database: {
      tables: [newsletterConnectionTable],
      migrationsFolder: join(packageFolder(import.meta.url), "migrations"),
    },

    routes: newsletterRoutes({ fetch: fetcher, signUpsPerMinute: options.signUpsPerMinute ?? 10 }),

    // An element for the builder's Insert menu.
    blocks: [
      defineBlock({
        handle: "newsletter_signup",
        name: "Newsletter sign-up",
        icon: "mail",
        category: "Newsletter",
        description: "An email box and a button, for people to join your mailing list.",
        properties: {
          heading: text({ required: true, default: defaultSignUpFormText.heading }),
          text: textarea(),
          button_label: text({ required: true, default: defaultSignUpFormText.buttonLabel }),
          consent_label: text({ required: true, default: defaultSignUpFormText.consentLabel }),
        },
        render: signUpBlockTemplate,
      }),
    ],

    // {% newsletter_signup heading: "Stay in touch", button: "Join", consent: "…" %}
    liquid: {
      tags: [
        {
          name: "newsletter_signup",
          render: ({ options: tagOptions }) => renderSignUpForm(tagOptions),
        },
      ],
    },

    // Unless people confirm by email, the "newsletter" form has to ask them first.
    formConsent: async (form, database) =>
      form.handle === NEWSLETTER_FORM && (await needsConsentTick(database))
        ? defaultSignUpFormText.consentLabel
        : null,

    // A form of the site's own with a ticked "newsletter" field signs its sender up too.
    events: {
      "form.submitted": async (event, { database, log }) => {
        const { fields, submitterEmail, consents = [] } = event.data.submission;
        // The site's own Newsletter element sends its form ("newsletter"); any other form signs
        // people up when they tick a box with the handle "newsletter".
        const tickedNewsletter = isTicked(fields.newsletter);
        const wantsNewsletter = event.data.form.handle === NEWSLETTER_FORM || tickedNewsletter;
        if (!wantsNewsletter || !submitterEmail) return;
        // A page published as files can be older than the rule, so this holds on its own.
        if (!tickedNewsletter && consents.length === 0 && (await needsConsentTick(database))) {
          log.info(`Left out the sender of "${event.data.form.name}": no consent box was ticked`);
          return;
        }
        const firstName = typeof fields.name === "string" ? fields.name.trim().slice(0, 100) : "";
        try {
          await signUp(database, fetcher, { email: submitterEmail, firstName });
        } catch (error) {
          log.error(`Couldn't sign up the sender of "${event.data.form.name}"`, error);
        }
      },
    },
  });
}

function isTicked(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value === true || value === "on" || value === "yes" || value === "true";
}

export default createNewsletterAddon();
