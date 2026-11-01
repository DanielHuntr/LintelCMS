# @lintel/field-conditions

Rules that show or hide a field depending on other fields' values ("Show when Layout is
Video"). The admin applies them as an editor types; the server applies the same rules when an
entry is saved, so a hidden field is never required and its value is cleared unless the field
keeps hidden values. Both import this package, so they can't disagree.

Plain TypeScript; its only dependency is Zod.

## The stored format

```json
{
  "handle": "video_url",
  "type": "video",
  "conditions": {
    "action": "show",
    "match": "all",
    "rules": [{ "field": "layout", "operator": "is", "value": "video" }],
    "keepHiddenValues": false
  }
}
```

`action` (`show` or `hide`), `match` (`all` or `any`) and `keepHiddenValues` can be left out.

| Operator         | Matches when the field...                                           |
| ---------------- | ------------------------------------------------------------------- |
| `is`             | equals the value; a field with several values has it among them     |
| `isNot`          | doesn't                                                             |
| `contains`       | has the text in it (any case), or the list has the item             |
| `doesNotContain` | doesn't                                                             |
| `isEmpty`        | is missing, blank or an empty list                                  |
| `isNotEmpty`     | has something                                                       |
| `greaterThan`    | is more than the value: numbers as numbers, dates and times as text |
| `lessThan`       | is less                                                             |
| `includesAny`    | shares at least one value with the list given                       |

Values compare as text, so `"3"` is `3` and `"true"` is `true`. An untouched toggle is off.

## Which field a rule looks at

- `layout`: a field beside this one (in the same group, repeater row or block);
- `address.country`: a field inside the group `address`;
- `$parent.layout`: a field beside the group, row or block this field is in;
- `$root.layout`: one of the entry's own fields, however deep this field is.

## Use

```ts
import { innerScope, isFieldVisible, topScope } from "@lintel/field-conditions";

const entry = topScope(entryData);
isFieldVisible(field.conditions, entry);
isFieldVisible(innerField.conditions, innerScope(row.data, entry));
```

## Files

| File                     | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `conditions.schema.ts`   | The stored format and its plain-English checks     |
| `evaluate-conditions.ts` | Scopes, references, operators and `isFieldVisible` |
