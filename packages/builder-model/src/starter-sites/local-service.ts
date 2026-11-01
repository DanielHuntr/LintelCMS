import { brandInvitation, contactDetails, contactForm, questions } from "../sections/closers.js";
import { featureCards, steps, story } from "../sections/features.js";
import { pageHeader, splitHero } from "../sections/heroes.js";
import { pricing, quoteCards } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const localServiceSite: StarterSite = {
  id: "local-service",
  name: "Local service",
  description:
    "A practical site for a local trade or service: what you do, honest prices, reviews and an easy way to book.",
  suitedTo: "Plumbers, cleaners, gardeners, tutors and repair shops",
  coverIllustration: "service-van",
  theme: {
    brandColour: "#1f6f9f",
    accentColour: "#c77d14",
    fontPairing: "friendly",
    cornerStyle: "round",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Friendly, reliable home repairs across the valley.",
      sections: [
        splitHero({
          label: "Home repairs, done right",
          heading: "Fixed properly, the first time",
          text: "Leaks, sticking doors, wobbly shelves and the jobs you’ve been putting off. Fair prices, tidy work and we turn up when we say we will.",
          primary: { label: "Book a visit", href: "/book" },
          secondary: { label: "See prices", href: "/services" },
          picture: { name: "service-van", alt: "A green work van" },
        }),
        featureCards({
          heading: "Why neighbours call us",
          points: [
            {
              heading: "On time, every time",
              text: "We give you a two-hour window and a text when we’re on our way.",
            },
            {
              heading: "Clear prices",
              text: "A fixed price before we start. If it changes, we ask first.",
            },
            {
              heading: "Tidy and careful",
              text: "Dust sheets down, shoes off, and we take the rubbish with us.",
            },
          ],
        }),
        quoteCards({
          heading: "Reviews from the valley",
          quotes: [
            {
              words: "Fixed a leak two other people couldn’t find. Lovely to deal with.",
              name: "Margaret, Elmfield",
            },
            {
              words: "Turned up early, finished early, cleaned up after. Ten out of ten.",
              name: "Dev, Station Road",
            },
            { words: "Our go-to for every little job now.", name: "The Kowalski family" },
          ],
        }),
        brandInvitation({
          heading: "Something needs fixing?",
          text: "Most jobs can be booked within the week.",
          button: { label: "Book a visit", href: "/book" },
        }),
      ],
    },
    {
      slug: "services",
      title: "Services and prices",
      summary: "What we do and what it costs.",
      sections: [
        pageHeader({
          label: "Services",
          heading: "Honest prices",
          text: "Every visit includes the first hour. Materials are charged at cost, with receipts.",
        }),
        pricing({
          heading: "Choose a visit",
          plans: [
            {
              name: "Quick fix",
              price: "£65",
              description: "Up to an hour, for small jobs.",
              includes: ["Dripping taps", "Sticking doors", "Hanging shelves"],
              button: { label: "Book a quick fix", href: "/book" },
            },
            {
              name: "Half day",
              price: "£180",
              description: "Up to four hours, for a list of jobs.",
              includes: ["Several small jobs", "Flat-pack assembly", "Minor plumbing"],
              button: { label: "Book a half day", href: "/book" },
              highlighted: true,
            },
            {
              name: "Full day",
              price: "£320",
              description: "For bigger projects.",
              includes: ["Bathroom refresh", "Fitting a new door", "Garden repairs"],
              button: { label: "Book a full day", href: "/book" },
            },
          ],
        }),
        story({
          heading: "Fully insured, properly qualified",
          text: "We’re members of the local trade association and carry full public liability insurance, so you’re covered whatever happens.",
          picture: { name: "service-tools", alt: "A toolbox and a spanner" },
          tone: "panel",
        }),
      ],
    },
    {
      slug: "book",
      title: "Book a visit",
      summary: "How to book, and what happens next.",
      sections: [
        pageHeader({
          label: "Booking",
          heading: "Book a visit",
          text: "Call, text or email with a few words about the job and a couple of times that suit you.",
        }),
        steps({
          heading: "What happens next",
          points: [
            { heading: "Tell us the job", text: "A short description and a photo if you can." },
            { heading: "Get a price", text: "We reply the same day with a fixed price." },
            { heading: "Pick a time", text: "Choose a two-hour window that suits you." },
          ],
        }),
        contactForm({
          heading: "Ask for a price",
          text: "Tell us about the job and we’ll reply the same day.",
          formHandle: "contact",
        }),
        contactDetails({
          heading: "Get in touch",
          text: "We answer the phone from 8am to 6pm and reply to messages within a few hours.",
          phone: "01632 960 772",
          email: "bookings@example.com",
          address: "Serving Elmfield, Ashby and the whole valley",
          hours: ["Monday to Friday, 8am to 6pm", "Saturday mornings for emergencies"],
        }),
        questions({
          heading: "Before you book",
          items: [
            {
              question: "Do you charge for a quote?",
              answer: "Never. Send a photo and we’ll give you a price for free.",
            },
            {
              question: "What if the job takes longer?",
              answer: "We’ll stop and ask before going over the time you booked.",
            },
          ],
        }),
      ],
    },
  ],
};
