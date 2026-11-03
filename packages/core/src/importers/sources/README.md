# Readers: each system's export into a `SourceSite`

Each reader only reads what it is given (it never fetches anything the files point at)
and says in `notes`, in plain words, what can't be moved. They are listed in
`source-readers.ts`.

| System   | Reads                                                                                        | Can't move                                                                 |
| -------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Webflow  | Collection CSVs; the code export zip (`html-pages.ts`)                                       | Interactions, animations, forms, scripts; collection templates; e-commerce |
| Framer   | Collection CSVs; a zip of saved pages, best effort                                           | Page designs as such: components, effects, interactions, scripted content  |
| Statamic | The site folder zip: collections, trees, blueprints, taxonomies, globals, navigation, assets | Templates, forms, users, Bard sets, replicator/grid fields                 |
| Umbraco  | A uSync zip (document types, content, media, dictionary), or Delivery API JSON               | Templates, members, forms, Block List/Grid, other languages                |

CSV columns don't say what kind of field they were, so `csv-collections.ts` works it out
from the values (switches, numbers, pictures, rich text, dates, choices); people can
change it on the mapping screen.
