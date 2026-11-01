import { brandInvitation, contactDetails, questions } from "../sections/closers.js";
import { featureCards, gallery, story } from "../sections/features.js";
import { pageHeader, splitHero } from "../sections/heroes.js";
import { quoteCards } from "../sections/social-proof.js";
import type { StarterSite } from "./starter-site.js";

export const bakerySite: StarterSite = {
  id: "bakery",
  name: "Bakery and café",
  description:
    "A warm, welcoming site for a bakery, café or deli: what you bake, your story and how to find you.",
  suitedTo: "Bakeries, cafés, delis and small restaurants",
  coverIllustration: "bakery-loaf",
  theme: {
    brandColour: "#a8502a",
    accentColour: "#3f6b4f",
    fontPairing: "classic",
    cornerStyle: "round",
  },
  pages: [
    {
      slug: "home",
      title: "Home",
      summary: "Bread, pastries and good coffee, baked fresh every morning.",
      sections: [
        splitHero({
          label: "Baked this morning",
          heading: "Bread worth getting up for",
          text: "Slow-proved sourdough, buttery pastries and coffee from a roaster down the road. Open from seven, until the shelves are empty.",
          primary: { label: "See today’s bakes", href: "/menu" },
          secondary: { label: "Find us", href: "/visit" },
          picture: { name: "bakery-loaf", alt: "A golden loaf of sourdough bread" },
        }),
        featureCards({
          label: "Why people queue",
          heading: "Simple things, done slowly",
          points: [
            {
              heading: "Forty-eight hour dough",
              text: "Our sourdough rests for two days before it meets the oven, for a crust that crackles and a soft, open crumb.",
            },
            {
              heading: "Flour from nearby",
              text: "We buy stoneground flour from a mill twenty miles away, and change our loaves with the harvest.",
            },
            {
              heading: "Nothing wasted",
              text: "Whatever is left at closing goes to the community fridge on Market Street.",
            },
          ],
        }),
        quoteCards({
          heading: "Kind words from regulars",
          quotes: [
            {
              words: "The cardamom buns are the best part of my Saturday.",
              name: "Hannah, Saturday regular",
            },
            {
              words: "Proper bread, friendly faces, and they remember my order.",
              name: "Tom, lives round the corner",
            },
            {
              words: "We ordered our wedding cake here and it was perfect.",
              name: "Amira and Joe",
            },
          ],
        }),
        brandInvitation({
          heading: "Ordering for a crowd?",
          text: "Platters of pastries and sandwiches for meetings and parties, with a day’s notice.",
          button: { label: "Plan an order", href: "/visit" },
        }),
      ],
    },
    {
      slug: "menu",
      title: "Menu",
      summary: "Our breads, pastries, cakes and drinks.",
      sections: [
        pageHeader({
          label: "Menu",
          heading: "What’s on the counter",
          text: "Everything is baked here each morning. Some things sell out early, so come by before lunch for the full choice.",
        }),
        gallery({
          heading: "Breads and bakes",
          items: [
            {
              picture: "bakery-loaf",
              alt: "A round sourdough loaf",
              title: "Country sourdough",
              text: "Our everyday loaf. Tangy, chewy, keeps for days. £4.50",
            },
            {
              picture: "bakery-croissant",
              alt: "A flaky croissant",
              title: "Butter croissant",
              text: "Laminated over three days, baked every hour until noon. £2.60",
            },
            {
              picture: "bakery-cup",
              alt: "A cup of steaming coffee",
              title: "Coffee and tea",
              text: "Espresso from Hillside Roasters and loose-leaf teas. From £2.20",
            },
          ],
        }),
        questions({
          heading: "Good to know",
          items: [
            {
              question: "Do you have gluten-free bakes?",
              answer:
                "Yes: a seeded loaf and two cakes every day, made on separate trays. We can’t promise a gluten-free kitchen, so please ask if you’re coeliac.",
            },
            {
              question: "Can I reserve a loaf?",
              answer: "Of course. Call before 5pm and we’ll keep one aside for the next morning.",
            },
            {
              question: "Is everything vegetarian?",
              answer: "Almost everything. Vegan bakes have a green leaf on the label.",
            },
          ],
        }),
      ],
    },
    {
      slug: "about",
      title: "Our story",
      summary: "How a home kitchen became a neighbourhood bakery.",
      sections: [
        pageHeader({
          label: "Our story",
          heading: "It started with one oven",
          text: "A home kitchen, a jar of starter called Bertie and a lot of early mornings.",
        }),
        story({
          heading: "From market stall to Market Street",
          text: "We sold our first loaves from a trestle table at the Saturday market. Five years and one very large oven later, we bake for the whole neighbourhood, but the recipes haven’t changed.",
          points: [
            "Six bakers, two baristas",
            "Open seven days a week",
            "Starter fed every day since 2019",
          ],
          picture: { name: "bakery-croissant", alt: "A croissant on a plate" },
        }),
        story({
          heading: "Come and bake with us",
          text: "Once a month we open the kitchen for a Sunday bread class. You’ll go home with your own loaf and a pot of starter.",
          more: { label: "Ask about the next class", href: "/visit" },
          picture: { name: "bakery-cup", alt: "A cup of coffee" },
          pictureFirst: true,
          tone: "panel",
        }),
      ],
    },
    {
      slug: "visit",
      title: "Visit us",
      summary: "Where we are, when we’re open and how to order.",
      sections: [
        pageHeader({
          label: "Visit",
          heading: "Come and see us",
          text: "We’re on the corner of Market Street and Mill Lane, five minutes from the station.",
        }),
        contactDetails({
          heading: "Say hello",
          text: "Call to reserve a loaf, order for an event or ask about allergens.",
          phone: "01632 960 418",
          email: "hello@example.com",
          address: "14 Market Street, Millbrook",
          hours: [
            "Tuesday to Friday, 7am to 4pm",
            "Saturday and Sunday, 8am to 3pm",
            "Closed on Mondays",
          ],
        }),
      ],
    },
  ],
};
