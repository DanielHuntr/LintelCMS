import { brandInvitation, questions, simpleFooter } from "../sections/closers.js";
import { featureCards, steps, story } from "../sections/features.js";
import { bannerHero, pageHeader, splitHero } from "../sections/heroes.js";
import { facts, pricing, singleQuote } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const productLaunchSite: StarterSite = {
  id: "product-launch",
  name: "Product landing",
  description:
    "A lively site for launching a product or app: the big idea, features, prices and questions answered.",
  suitedTo: "Apps, gadgets, subscriptions and new launches",
  coverIllustration: "product-phone",
  theme: {
    brandColour: "#5b3df5",
    accentColour: "#e08a00",
    fontPairing: "geometric",
    cornerStyle: "round",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Plan your week in five minutes with Tally.",
      sections: [
        splitHero({
          label: "New: Tally for teams",
          heading: "Your week, planned in five minutes",
          text: "Tally gathers your tasks, meetings and errands into one calm list, then suggests a plan you can change with a tap.",
          primary: { label: "Try it free", href: "/pricing" },
          secondary: { label: "See how it works", href: "/features" },
          picture: { name: "product-phone", alt: "A phone showing the Tally app" },
        }),
        facts([
          { value: "5 min", label: "to plan a week" },
          { value: "40k", label: "people planning with Tally" },
          { value: "4.8", label: "average app rating" },
        ]),
        featureCards({
          heading: "Less juggling, more doing",
          tone: "panel",
          points: [
            {
              heading: "One list for everything",
              text: "Work tasks, family plans and the shopping, finally in the same place.",
            },
            {
              heading: "Plans that bend",
              text: "Something came up? Drag it to tomorrow and Tally reshuffles the rest.",
            },
            {
              heading: "Private by design",
              text: "Your plans stay on your devices. We never sell or read your data.",
            },
          ],
        }),
        singleQuote({
          words: "I stopped dreading Monday mornings. That’s really all I can say.",
          name: "Leah, product designer",
        }),
        brandInvitation({
          heading: "Start planning today",
          text: "Free for one person, forever. No card needed.",
          button: { label: "Get Tally", href: "/pricing" },
        }),
      ],
    },
    {
      slug: "features",
      title: "Features",
      summary: "Everything Tally does, step by step.",
      sections: [
        pageHeader({
          label: "Features",
          heading: "How Tally works",
          text: "Three steps on Sunday evening, and the week takes care of itself.",
        }),
        steps({
          heading: "Plan in three steps",
          points: [
            { heading: "Collect", text: "Add tasks by typing, talking or forwarding an email." },
            {
              heading: "Arrange",
              text: "Tally suggests when to do each thing, around your calendar.",
            },
            { heading: "Adjust", text: "Move anything with a tap; the rest of the week follows." },
          ],
        }),
        story({
          heading: "Works where you do",
          text: "Phone, tablet and computer, always in step. Tally also fits in with the calendars you already use.",
          points: ["Phone and tablet apps", "Works in any browser", "Connects to your calendar"],
          picture: { name: "product-waves", alt: "Colourful waves" },
        }),
        story({
          heading: "Built for households and teams",
          text: "Share a list with your family or your team, and see who’s doing what without another meeting.",
          picture: { name: "product-box", alt: "An orange box" },
          pictureFirst: true,
          tone: "panel",
        }),
      ],
    },
    {
      slug: "pricing",
      title: "Pricing",
      summary: "Free for one person; simple prices for families and teams.",
      sections: [
        bannerHero({
          heading: "Simple, fair prices",
          text: "Start free. Upgrade when you share with others.",
          primary: { label: "Compare plans", href: "#plans" },
        }),
        pricing({
          heading: "Pick a plan",
          plans: [
            {
              name: "Personal",
              price: "Free",
              description: "For planning your own week.",
              includes: ["Unlimited tasks", "All devices", "Calendar connection"],
              button: { label: "Start free", href: "/pricing" },
            },
            {
              name: "Family",
              price: "£4 / month",
              description: "For up to six people at home.",
              includes: ["Everything in Personal", "Shared lists", "Chores and rotas"],
              button: { label: "Try Family", href: "/pricing" },
              highlighted: true,
            },
            {
              name: "Team",
              price: "£6 / person",
              description: "For teams at work.",
              includes: ["Everything in Family", "Team planning board", "Priority support"],
              button: { label: "Try Team", href: "/pricing" },
            },
          ],
        }),
        questions({
          heading: "Questions",
          items: [
            {
              question: "Can I cancel any time?",
              answer: "Yes. Plans are monthly and you can cancel from the app in two taps.",
            },
            {
              question: "Is there a student discount?",
              answer: "Students get Family at half price. Email us from your college address.",
            },
            {
              question: "Where is my data kept?",
              answer:
                "On your devices, with an encrypted backup in the UK that only you can unlock.",
            },
          ],
        }),
        simpleFooter({
          text: "Tally is made by a small team in Leeds.",
          links: [
            { label: "Features", href: "/features" },
            { label: "Pricing", href: "/pricing" },
          ],
        }),
      ],
    },
  ],
};
