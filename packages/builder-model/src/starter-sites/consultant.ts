import { contactDetails, panelInvitation, questions } from "../sections/closers.js";
import { featureCards, steps, story } from "../sections/features.js";
import { centredHero, pageHeader } from "../sections/heroes.js";
import { facts, pricing, singleQuote } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const consultantSite: StarterSite = {
  id: "consultant",
  name: "Consultant",
  description:
    "A calm, credible site for a consultant or coach: what you help with, how you work and what it costs.",
  suitedTo: "Consultants, coaches, accountants and advisers",
  coverIllustration: "consultant-chart",
  theme: {
    brandColour: "#1f4f80",
    accentColour: "#b7791f",
    fontPairing: "editorial",
    cornerStyle: "soft",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Practical advice for small businesses that want to grow without the chaos.",
      sections: [
        centredHero({
          label: "Strategy for small teams",
          heading: "Grow steadily, without the chaos",
          text: "I help owners of businesses with five to fifty people make clear plans, fix what slows them down and get their evenings back.",
          primary: { label: "Book a free call", href: "/contact" },
          secondary: { label: "How I work", href: "/services" },
        }),
        facts([
          { value: "15", label: "years advising owners" },
          { value: "120+", label: "businesses helped" },
          { value: "3×", label: "average growth in two years" },
        ]),
        featureCards({
          heading: "Where I can help",
          tone: "panel",
          points: [
            {
              heading: "A plan you’ll actually use",
              text: "One page that says where you’re going this year and what each person does to get there.",
            },
            {
              heading: "Fewer fires to put out",
              text: "We find the jobs that keep landing on your desk and give them a home.",
            },
            {
              heading: "Numbers you understand",
              text: "A simple monthly view of cash, margins and pipeline, without spreadsheets you dread.",
            },
          ],
        }),
        singleQuote({
          words:
            "In six months we went from guessing to knowing. The plan is still pinned above my desk.",
          name: "Ruth Okafor, founder of Tidewater Studio",
        }),
        panelInvitation({
          heading: "Not sure where to start?",
          text: "A free thirty-minute call is usually enough to find the first thing to fix.",
          button: { label: "Book a call", href: "/contact" },
        }),
      ],
    },
    {
      slug: "services",
      title: "Services",
      summary: "How working together goes, and what it costs.",
      sections: [
        pageHeader({
          label: "Services",
          heading: "Clear help, clear prices",
          text: "Every engagement starts with a conversation and ends with something you can keep using.",
        }),
        steps({
          heading: "How we’ll work",
          points: [
            {
              heading: "Listen",
              text: "A long conversation with you and your team about what’s working and what isn’t.",
            },
            {
              heading: "Plan",
              text: "A short, plain plan with three priorities and who owns each.",
            },
            {
              heading: "Do",
              text: "Fortnightly sessions to keep things moving and clear the way.",
            },
            {
              heading: "Review",
              text: "After three months we look back honestly and decide what’s next.",
            },
          ],
        }),
        pricing({
          heading: "Ways to work together",
          text: "Fixed prices, agreed before we start. No hourly surprises.",
          plans: [
            {
              name: "Health check",
              price: "£950",
              description: "A one-off review with a written plan.",
              includes: ["Two half-day sessions", "A one-page plan", "One follow-up call"],
              button: { label: "Ask about it", href: "/contact" },
            },
            {
              name: "Quarter plan",
              price: "£3,200",
              description: "Three months of steady support.",
              includes: [
                "Everything in Health check",
                "Six fortnightly sessions",
                "Monthly numbers review",
              ],
              button: { label: "Start a quarter", href: "/contact" },
              highlighted: true,
            },
            {
              name: "On call",
              price: "£600 / month",
              description: "For owners who want a sounding board.",
              includes: ["A monthly session", "Same-day replies", "Cancel any time"],
              button: { label: "Ask about it", href: "/contact" },
            },
          ],
        }),
        questions({
          heading: "Questions owners ask",
          items: [
            {
              question: "Do you work with businesses outside the UK?",
              answer:
                "Yes. Most sessions happen on video calls, so anywhere within a few hours of London time works well.",
            },
            {
              question: "Will you talk to my team?",
              answer: "I’d like to. The best plans come from the people who do the work every day.",
            },
          ],
        }),
      ],
    },
    {
      slug: "about",
      title: "About",
      summary: "Who I am and why I do this work.",
      sections: [
        pageHeader({
          label: "About",
          heading: "Hello, I’m Morgan",
          text: "I ran a growing business for ten years before I started helping others run theirs.",
        }),
        story({
          heading: "I’ve sat in your chair",
          text: "I know what it’s like to be the person everyone asks. These days I help owners build businesses that don’t depend on them for every decision, so they can grow without burning out.",
          points: [
            "Former operations director",
            "Certified business coach",
            "Volunteer mentor for new founders",
          ],
          picture: { name: "consultant-desk", alt: "A tidy desk with a laptop and a plant" },
        }),
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      summary: "Book a free call or send a message.",
      sections: [
        pageHeader({
          label: "Contact",
          heading: "Let’s talk",
          text: "Tell me a little about your business and what’s on your mind. I reply within one working day.",
        }),
        contactDetails({
          heading: "Book a free call",
          text: "Thirty minutes, no obligation. You’ll leave with at least one idea to try.",
          phone: "020 7946 0321",
          email: "morgan@example.com",
          address: "Studio 4, Canal Works, London",
          hours: ["Calls Monday to Thursday", "9am to 6pm UK time"],
        }),
      ],
    },
  ],
};
