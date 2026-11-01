# Accessibility

| File               | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `axe-check.ts`     | Runs axe (WCAG 2.2 A and AA), fails on serious and critical findings |
| `admin-screens.ts` | Every admin screen and overlay the sweep visits in light and dark    |
| `keyboard.ts`      | `tabTo`: move focus with Tab only, and check the focus can be seen   |

A failure lists each problem with its impact, the rule, a link explaining the fix, and the
elements involved. Every check also attaches all findings (minor ones included) as JSON to
the test, so they can be reviewed in the HTML report.
