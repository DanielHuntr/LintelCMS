# 59. Components: blocks with variants, and turning similar elements into one

Date: 2026-11-03

## Context

Decision 27 gave sites their own blocks: a design with properties, instances that keep only
values, and one renderer. It left variants out. Designers expect one Button in three sizes,
filled or outlined, with or without an icon, and clients expect a simple panel.

A real case showed a second gap. Daniel made a project row a shared style, applied it to eight
rows, animated one row's title and expected all eight to follow. Shared styles (decision 38)
share an element's own look only, so nothing inside the rows followed.

## Decision

### Blocks become components

There is one system. The builder and the admin call the site's blocks **components**; the
table, API, handles and `customBlock` element keep their names, so nothing stored changes.
Content types' blocks fields keep theirs, since they are a different thing.

Everything inside a component's design belongs to the design: structure, styles, animations,
effects, pointer settings and what clients may change. Instances hold only values and variant
choices, so they can't drift. Expansion now points animation targets, scene steps and styles
that follow an owner at each instance's own copies, which it didn't do before.

### Variants are differences from the design

A component has variant properties (Size: Small, Medium, Large), each with a default. The
design is the look with every value at its default. Every other look is stored as differences
for the values it belongs to:

    { when: { size: "small" }, elements: { <element id>: { styles, removedStyles, props, hidden } } }

An instance shows the design with every matching look laid on top, least specific first. So
Small and Outline combine, Small + Outline can still have a look of its own, and a change to
the design reaches every variant that doesn't say otherwise. Twelve combinations don't need
twelve designs. Instances store only choices that differ from the defaults (`props.variant`),
so a new default reaches instances that never chose.

Looks are applied before expansion, so the canvas, the website, Detach and previews agree.

### Editing a variant

A bar over the canvas picks the variant shown and says where changes go. Values at their
default don't count, so with Size: Small and everything else at its default, changes go to
Small whatever the other choices are; with Small and Outline, to that combination; with all
defaults, to the design. The designer edits as usual and `recordVariantEdit` compares the
result with what the design and less specific looks give. New, moved and renamed elements
belong to every variant. An element deleted while showing a variant is hidden in that variant.

### Clients

Clients fill in an instance's properties. They choose its variant only when the component's
**Clients can choose variants** is on. `findDesignChanges` checks both on the server, and a
different component on the instance is always a design change. This replaces the closed
position in decision 53 for components.

### Make these one component

From a multi-selection, an element with a shared style, or an element with similar siblings,
**Make these one component** builds a component from the first and turns all of them into
instances. Similar means the same kinds of element nested the same way. Words, pictures and
links that differ become properties, each element keeping its own. The dialog shows this first
and it is one step in Undo. Style suggests it under the shared-style row.

An animation or effect found on any element, on a part where the first has none, goes into the
design and the dialog says so: someone who animated row four means every title to move.
Pictures that differ but aren't all in the media library can't be properties, and the dialog
warns that every one will show the first one's.

### Several selected

The selection stays one element in the editor's state, with the others held beside it in the
builder, so everything that works on one element is unchanged. Bulk changes are single history
steps. Values are shown only when shared, otherwise Mixed. The client's view selects one
element at a time.

## Why

Differences rather than a design per combination is what keeps "change it in one place" true:
a matrix of copies would need every change made many times. Recording edits by comparison lets
the whole Style panel work on a variant with no change to its controls.

Choices no longer offered fall back to the default when a page is saved, as values of removed
properties are dropped (decision 27), so removing a choice doesn't make pages impossible to save.

## Alternatives considered

- **A design per combination**: simple to draw, but changes multiply, and three properties
  already make twelve copies.
- **Variants as shared-style variants only** (decision 38): they can't hide a part or change
  anything inside the element.
- **An "Any" option on each variant in the bar**: more exact, and more to explain. Treating
  defaults as "any" covers the usual case.
- **Renaming the table and API to components**: a migration and a broken API for a word.

## Consequences

- Migration 0034 adds `blocks.variants`, with none for blocks saved before.
- Blocks written in code and by plugins have no variants; they have no design to differ from.
- Changing a variant's default changes what the design means: looks stay as they are, so a
  designer may need to look again at them.
- Removing a choice forgets its looks, and **Edit variants** says so.
- Changing which variant shows in the designer starts a new Undo history.
- An element's own style differences are given up when it joins a component. The dialog says
  layout, styles and animation are shared.
