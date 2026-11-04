import { describe, expect, it } from "vitest";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
} from "../document/page-document.schema.js";
import { findNode, listNodes } from "../tree/tree-queries.js";
import { LiveDocument } from "./live-document.js";
import { mergeText } from "./merge-text.js";
import {
  applyPageChanges,
  diffPages,
  findClashes,
  type PageChange,
  pageChangesSchema,
} from "./page-changes.js";

function element(id: string, overrides: Partial<PageNode> = {}): PageNode {
  return {
    id,
    type: "box",
    name: "",
    props: {},
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
    ...overrides,
  };
}

function page(...children: PageNode[]): PageDocument {
  const empty = createEmptyPage();
  return { ...empty, root: { ...empty.root, children } };
}

const heading = (words: string) => element("h", { type: "heading", props: { text: words } });

/** A page's shape and values, however it got there. */
const shape = (document: PageDocument) => JSON.parse(JSON.stringify(document)) as PageDocument;

function expectDiffToWork(before: PageDocument, after: PageDocument) {
  const changes = diffPages(before, after);
  expect(diffPages(applyPageChanges(before, changes), after)).toEqual([]);
  return changes;
}

describe("working out what changed", () => {
  it("says nothing for the same page", () => {
    const same = page(heading("Hello"));
    expect(diffPages(same, shape(same))).toEqual([]);
  });

  it("changes one prop, not the element", () => {
    const before = page(element("a", { props: { level: 1, href: "/old" } }));
    const after = page(element("a", { props: { level: 2, href: "/old" } }));
    expect(expectDiffToWork(before, after)).toEqual([
      { op: "set", node: "a", path: ["props", "level"], value: 2 },
    ]);
  });

  it("changes one style at one screen size", () => {
    const before = page(element("a", { styles: { base: { color: "red", marginTop: "1px" } } }));
    const after = page(
      element("a", {
        styles: { base: { color: "red", marginTop: "2px" }, phone: { color: "blue" } },
      }),
    );
    expect(expectDiffToWork(before, after)).toEqual([
      { op: "set", node: "a", path: ["styles", "base", "marginTop"], value: "2px" },
      { op: "set", node: "a", path: ["styles", "phone", "color"], value: "blue" },
    ]);
  });

  it("takes values away", () => {
    const before = page(element("a", { props: { href: "/x" }, effects: [] }));
    const after = page(element("a"));
    const changes = expectDiffToWork(before, after);
    expect(changes).toContainEqual({ op: "set", node: "a", path: ["props", "href"] });
    expect(changes).toContainEqual({ op: "set", node: "a", path: ["effects"] });
  });

  it("handles styles that follow another element's state", () => {
    const owner = (colour: string) =>
      element("a", { styles: { base: {}, owners: { "hover@b": { color: colour } } } });
    expect(expectDiffToWork(page(owner("red")), page(owner("blue")))).toEqual([
      { op: "set", node: "a", path: ["styles", "owners", "hover@b", "color"], value: "blue" },
    ]);
  });

  it("treats sentences as words that can merge", () => {
    expect(
      expectDiffToWork(page(heading("Fresh bread")), page(heading("Fresh rye bread"))),
    ).toEqual([
      { op: "text", node: "h", prop: "text", from: "Fresh bread", to: "Fresh rye bread" },
    ]);
  });

  it("adds a whole section as one step", () => {
    const section = element("s", { children: [element("t"), element("u")] });
    expect(expectDiffToWork(page(element("a")), page(element("a"), section))).toEqual([
      { op: "insert", parent: "page", after: "a", node: section },
    ]);
  });

  it("removes only the outermost element", () => {
    const section = element("s", { children: [element("t")] });
    expect(expectDiffToWork(page(section), page())).toEqual([{ op: "remove", node: "s" }]);
  });

  it("moves as few elements as it can", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => element(id)) as [
      PageNode,
      PageNode,
      PageNode,
      PageNode,
    ];
    expect(expectDiffToWork(page(a, b, c, d), page(d, a, b, c))).toEqual([
      { op: "move", node: "d", parent: "page", after: null },
    ]);
  });

  it("moves an element to another parent", () => {
    const before = page(element("x", { children: [element("c")] }), element("y"));
    const after = page(element("x"), element("y", { children: [element("c")] }));
    expect(expectDiffToWork(before, after)).toEqual([
      { op: "move", node: "c", parent: "y", after: null },
    ]);
  });

  it("wraps existing elements in a new one", () => {
    const before = page(element("a"), element("b"));
    const after = page(element("wrap", { children: [element("a"), element("b")] }));
    expectDiffToWork(before, after);
  });

  it("turns a parent and child inside out", () => {
    const before = page(element("p", { children: [element("q")] }));
    const after = page(element("q", { children: [element("p")] }));
    expectDiffToWork(before, after);
  });

  it("keeps an element from a removed section by moving it out first", () => {
    const before = page(element("s", { children: [element("keep"), element("lose")] }));
    const after = page(element("keep"));
    const changes = expectDiffToWork(before, after);
    expect(changes.map((each) => each.op)).toEqual(["move", "remove"]);
  });

  it("gets from any shuffled tree to any other", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let seed = 7;
    const random = (limit: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % limit;
    };
    const randomPage = () => {
      const placed: PageNode[] = [];
      const top: PageNode[] = [];
      for (const id of ids) {
        if (random(4) === 0) continue;
        const node = element(id, { props: { size: random(3) } });
        const parent = random(2) === 0 ? placed[random(placed.length || 1)] : undefined;
        (parent ? parent.children : top).splice(random(top.length + 1), 0, node);
        placed.push(node);
      }
      return page(...top);
    };
    for (let round = 0; round < 300; round += 1) expectDiffToWork(randomPage(), randomPage());
  });
});

describe("applying changes", () => {
  it("does nothing for an element that has gone", () => {
    const start = page(element("a"));
    const steps: PageChange[] = [
      { op: "set", node: "gone", path: ["name"], value: "x" },
      { op: "text", node: "gone", prop: "text", from: "a", to: "b" },
      { op: "move", node: "gone", parent: "a", after: null },
      { op: "insert", parent: "gone", after: null, node: element("n") },
      { op: "remove", node: "gone" },
    ];
    expect(applyPageChanges(start, steps)).toBe(start);
  });

  it("never lets a step change an id or the list of children", () => {
    const start = page(element("a"));
    const steps: PageChange[] = [
      { op: "set", node: "a", path: ["id"], value: "b" },
      { op: "set", node: "a", path: ["children"], value: [] },
    ];
    expect(applyPageChanges(start, steps)).toBe(start);
  });

  it("does not remove the page itself", () => {
    const start = page();
    expect(applyPageChanges(start, [{ op: "remove", node: start.root.id }])).toBe(start);
  });

  it("does not put an element inside itself", () => {
    const start = page(element("p", { children: [element("q")] }));
    expect(applyPageChanges(start, [{ op: "move", node: "p", parent: "q", after: null }])).toBe(
      start,
    );
  });

  it("does not add an element twice", () => {
    const start = page(element("a"));
    const again: PageChange = { op: "insert", parent: "page", after: null, node: element("a") };
    expect(applyPageChanges(start, [again])).toBe(start);
  });

  it("adds at the end when the sibling it followed has gone", () => {
    const start = page(element("a"), element("b"));
    const next = applyPageChanges(start, [
      { op: "insert", parent: "page", after: "gone", node: element("n") },
    ]);
    expect(next.root.children.map((child) => child.id)).toEqual(["a", "b", "n"]);
  });

  it("keeps the site's navigation first and footer last", () => {
    const start = page(element("site-navigation"), element("a"), element("site-footer"));
    const next = applyPageChanges(start, [
      { op: "insert", parent: "page", after: null, node: element("first") },
      { op: "insert", parent: "page", after: "gone", node: element("last") },
    ]);
    expect(next.root.children.map((child) => child.id)).toEqual([
      "site-navigation",
      "first",
      "a",
      "last",
      "site-footer",
    ]);
  });

  it("keeps styled words inside the words", () => {
    const start = page(
      element("h", {
        props: {
          text: "Fresh bread today",
          marks: [{ from: 6, to: 11, styles: { color: "red" } }],
        },
      }),
    );
    const next = applyPageChanges(start, [
      { op: "text", node: "h", prop: "text", from: "Fresh bread today", to: "Fresh" },
    ]);
    expect(findNode(next.root, "h")?.props.marks).toEqual([]);
  });

  it("refuses steps that reach for an object's prototype", () => {
    const parsed = pageChangesSchema.safeParse([
      { op: "set", node: "a", path: ["props", "__proto__"], value: { admin: true } },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("refuses more steps than a message may hold", () => {
    const steps = Array.from({ length: 5001 }, () => ({ op: "remove", node: "a" }));
    expect(pageChangesSchema.safeParse(steps).success).toBe(false);
  });
});

describe("merging words", () => {
  it("keeps both edits in different parts of the words", () => {
    expect(mergeText("Fresh bread daily", "Fresh rye bread daily", "Fresh bread every day")).toBe(
      "Fresh rye bread every day",
    );
  });

  it("works whichever edit comes first in the words", () => {
    expect(mergeText("one two three", "one two 3", "1 two three")).toBe("1 two 3");
  });

  it("gives the later edit when both changed the same words", () => {
    expect(mergeText("Hello world", "Hello there", "Hello you")).toBe("Hello there");
  });

  it("is harmless when applied twice", () => {
    expect(mergeText("a b", "a b c", "a b c")).toBe("a b c");
  });

  it("keeps two people's words added at the same place", () => {
    expect(mergeText("a c", "a b c", "a c d")).toBe("a b c d");
  });
});

describe("finding clashes", () => {
  const base = page(heading("Fresh bread"), element("a", { styles: { base: { color: "red" } } }));
  const clashes = (mine: PageDocument, theirs: PageDocument) =>
    findClashes(base, diffPages(base, mine), diffPages(base, theirs)).map((each) => each.nodeId);
  const withColour = (colour: string) =>
    page(heading("Fresh bread"), element("a", { styles: { base: { color: colour } } }));

  it("finds none in different elements", () => {
    expect(
      clashes(page(heading("Rye bread"), base.root.children[1] as PageNode), withColour("blue")),
    ).toEqual([]);
  });

  it("finds the same value changed to two things", () => {
    expect(clashes(withColour("blue"), withColour("green"))).toEqual(["a"]);
  });

  it("finds nothing when both made the same change", () => {
    expect(clashes(withColour("blue"), withColour("blue"))).toEqual([]);
  });

  it("finds a change to what the other person removed", () => {
    expect(clashes(withColour("blue"), page(heading("Fresh bread")))).toEqual(["a"]);
  });

  it("finds a change to something inside what was removed", () => {
    const nested = page(element("s", { children: [element("t", { name: "Old" })] }));
    const mine = page(element("s", { children: [element("t", { name: "New" })] }));
    const found = findClashes(nested, diffPages(nested, mine), diffPages(nested, page()));
    expect(found).toEqual([{ nodeId: "t" }]);
  });
});

describe("two people editing one page", () => {
  /** A stand-in for the server: one order, applied as it arrives. */
  function server(start: PageDocument) {
    let document = start;
    let sequence = 0;
    return {
      get document() {
        return document;
      },
      take(changes: readonly PageChange[]) {
        document = applyPageChanges(document, changes);
        sequence += 1;
        return sequence;
      },
    };
  }

  function send(from: LiveDocument, to: LiveDocument, host: ReturnType<typeof server>) {
    const batch = from.nextBatch();
    if (!batch) return;
    const sequence = host.take(batch.changes);
    from.accepted(batch.id, sequence);
    to.remote(batch.changes);
  }

  const start = page(heading("Fresh bread"), element("a"), element("b"));
  const ids = (document: PageDocument) => document.root.children.map((child) => child.id);
  const renamed = (document: PageDocument, id: string, name: string): PageDocument => ({
    ...document,
    root: {
      ...document.root,
      children: document.root.children.map((child) =>
        child.id === id ? { ...child, name } : child,
      ),
    },
  });

  it("ends with the same page for both, with both changes", () => {
    const host = server(start);
    const sam = new LiveDocument(start, "sam");
    const ada = new LiveDocument(start, "ada");
    sam.edit(renamed(sam.document, "a", "Sam was here"));
    ada.edit(renamed(ada.document, "b", "Ada was here"));
    send(sam, ada, host);
    send(ada, sam, host);
    expect(shape(sam.document)).toEqual(shape(host.document));
    expect(shape(ada.document)).toEqual(shape(host.document));
    expect(findNode(host.document.root, "a")?.name).toBe("Sam was here");
    expect(findNode(host.document.root, "b")?.name).toBe("Ada was here");
  });

  it("gives the same value to both when both change the same one", () => {
    const host = server(start);
    const sam = new LiveDocument(start, "sam");
    const ada = new LiveDocument(start, "ada");
    sam.edit(renamed(sam.document, "a", "Sam"));
    ada.edit(renamed(ada.document, "a", "Ada"));
    send(sam, ada, host);
    // Ada's own edit stays on her screen until the server has its say.
    expect(findNode(ada.document.root, "a")?.name).toBe("Ada");
    send(ada, sam, host);
    expect(findNode(sam.document.root, "a")?.name).toBe("Ada");
    expect(findNode(host.document.root, "a")?.name).toBe("Ada");
  });

  it("keeps one person's edits on top while the other's arrive", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "Mine"));
    const update = sam.remote([{ op: "move", node: "b", parent: "page", after: null }]);
    expect(ids(update.document)).toEqual(["b", "h", "a"]);
    expect(findNode(update.document.root, "a")?.name).toBe("Mine");
  });

  it("sends one batch at a time and gathers what comes meanwhile", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "One"));
    const first = sam.nextBatch();
    sam.edit(renamed(sam.document, "a", "Two"));
    sam.edit(renamed(sam.document, "a", "Three"));
    expect(sam.nextBatch()).toBeNull();
    sam.accepted(first?.id ?? "", 1);
    expect(sam.nextBatch()?.changes).toHaveLength(2);
  });

  it("sends a lot of waiting steps a part at a time", () => {
    const sam = new LiveDocument(start, "sam");
    const words = "x".repeat(400 * 1024);
    for (const id of ["a", "b"]) {
      sam.edit(renamed(sam.document, id, words));
    }
    sam.edit(renamed(sam.document, "h", words));
    const first = sam.nextBatch();
    expect(first?.changes).toHaveLength(2);
    expect(sam.isSendingTooMuch).toBe(false);
    sam.accepted(first?.id ?? "", 1);
    expect(sam.nextBatch()?.changes).toHaveLength(1);
  });

  it("knows when one step is too big to send", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "x".repeat(1200 * 1024)));
    sam.nextBatch();
    expect(sam.isSendingTooMuch).toBe(true);
  });

  it("takes an edit back when the server refuses it", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "Not allowed"));
    const batch = sam.nextBatch();
    const update = sam.refused(batch?.id ?? "");
    expect(findNode(update?.document.root ?? start.root, "a")?.name).toBe("");
    expect(sam.hasWaitingChanges).toBe(false);
  });

  it("keeps edits made offline and sends them on coming back", () => {
    const host = server(start);
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "Sent before the drop"));
    const sentBefore = sam.nextBatch();
    sam.edit(renamed(sam.document, "b", "Typed offline"));
    const theirs: PageChange[] = [{ op: "set", node: "h", path: ["name"], value: "Theirs" }];
    host.take(theirs);
    const update = sam.rejoin(host.document, false);
    expect(findNode(update.document.root, "h")?.name).toBe("Theirs");
    expect(findNode(update.document.root, "b")?.name).toBe("Typed offline");
    expect(update.changes).toEqual(theirs);
    const again = sam.nextBatch();
    expect(again?.id).toBe(sentBefore?.id);
    sam.accepted(again?.id ?? "", host.take(again?.changes ?? []));
    const batch = sam.nextBatch();
    expect(batch?.changes).toHaveLength(1);
    sam.accepted(batch?.id ?? "", host.take(batch?.changes ?? []));
    expect(shape(sam.document)).toEqual(shape(host.document));
  });

  it("sends confirmed steps again if the server restarted before storing them", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "Nearly stored"));
    const batch = sam.nextBatch();
    sam.accepted(batch?.id ?? "", 1);
    sam.rejoin(start, true);
    expect(findNode(sam.document.root, "a")?.name).toBe("Nearly stored");
    expect(sam.hasWaitingChanges).toBe(true);
  });

  it("does not send stored steps again", () => {
    const sam = new LiveDocument(start, "sam");
    sam.edit(renamed(sam.document, "a", "Stored"));
    const batch = sam.nextBatch();
    sam.accepted(batch?.id ?? "", 4);
    sam.stored(4);
    expect(sam.hasUnstoredChanges).toBe(false);
  });

  it("settles on one page under random edits from three people", () => {
    let seed = 11;
    const random = (limit: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % limit;
    };
    for (let round = 0; round < 40; round += 1) {
      const host = server(start);
      const people = ["a1", "b2", "c3"].map((name) => new LiveDocument(start, name));
      const everyoneElse = (person: LiveDocument) => people.filter((each) => each !== person);
      for (let step = 0; step < 60; step += 1) {
        const person = people[random(3)] as LiveDocument;
        const nodes = listNodes(person.document.root).filter((node) => node.id !== "page");
        const target = nodes[random(nodes.length || 1)];
        const roll = random(5);
        if (roll === 0 && target) {
          const changed = applyPageChanges(person.document, [{ op: "remove", node: target.id }]);
          person.edit(changed);
        } else if (roll === 1) {
          const node = element(`n${round}-${step}`);
          const place = target?.id ?? null;
          person.edit(
            applyPageChanges(person.document, [
              { op: "insert", parent: "page", after: place, node },
            ]),
          );
        } else if (roll === 2 && target) {
          const parent = nodes[random(nodes.length)]?.id ?? "page";
          person.edit(
            applyPageChanges(person.document, [
              { op: "move", node: target.id, parent, after: null },
            ]),
          );
        } else if (target) {
          person.edit(
            applyPageChanges(person.document, [
              { op: "set", node: target.id, path: ["name"], value: `v${step}` },
            ]),
          );
        }
        const batch = person.nextBatch();
        if (batch) {
          const sequence = host.take(batch.changes);
          person.accepted(batch.id, sequence);
          for (const other of everyoneElse(person)) other.remote(batch.changes);
        }
      }
      for (const person of people) {
        const batch = person.nextBatch();
        if (!batch) continue;
        person.accepted(batch.id, host.take(batch.changes));
        for (const other of everyoneElse(person)) other.remote(batch.changes);
      }
      for (const person of people) expect(shape(person.document)).toEqual(shape(host.document));
    }
  });
});
