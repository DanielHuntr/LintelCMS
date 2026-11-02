# Lintel 1.0.0-rc.1: visual and usability review

Every item below was observed in a real browser and has a screenshot. The classification follows QA prompt §9 step 4. Defects are cross-referenced to BUG-REPORT.md. Subjective items go to UX-IMPROVEMENTS.md and are not to be implemented without approval.

| ID    | Screen                   | Observation                                                                                                   | Class                                                          | Ref      | Screenshot                                     |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------- |
| VR-01 | Website product page     | The closed basket drawer is drawn over the right of the page and cuts "Add to basket" in half                 | Confirmed defect                                               | FUNC-001 | `50-site-product-page.png`                     |
| VR-02 | Website basket           | Subtotal £90.00 → Total £81.00 with no discount line; no code field                                           | Confirmed defect                                               | FUNC-003 | `54-site-cart-with-items.png`                  |
| VR-03 | Website basket           | Raw JS error text in the checkout message area                                                                | Confirmed defect                                               | FUNC-002 | `55-site-choose-delivery-error.png`            |
| VR-04 | Website basket           | Broken-image icon for a line without a picture                                                                | Visual inconsistency (product page uses a neutral placeholder) | VIS-001  | `55-…`                                         |
| VR-05 | Admin at 390px           | The sidebar stays full width and the content is clipped; horizontal scroll                                    | Accessibility defect (Reflow) / usability                      | UX-001   | `40-42-mobile-*.png`                           |
| VR-06 | Builder                  | Two headers and two footers; the inserted header says "Your site"                                             | Confirmed defect                                               | FUNC-005 | `71-builder-header-footer.png`                 |
| VR-07 | Updates                  | Warning banner and "You're up to date" card contradict each other; raw "(… answered 403)" in user copy        | Confirmed defect                                               | FUNC-006 | `21-updates.png`                               |
| VR-08 | Customer detail          | "No orders yet." directly above an "Orders before the move" list; "Spent: Nothing yet."                       | Confirmed defect (data presentation)                           | DATA-002 | `60-customer-ada.png`                          |
| VR-09 | Products / Shop settings | "Commerce" vs "Shop" naming                                                                                   | Visual/wording inconsistency                                   | UX-002   | `31-products-dark.png`, `26-shop-settings.png` |
| VR-10 | Several                  | Content column widths differ between list and form pages                                                      | Subjective; needs a design decision                            | UXI-03   | `12`, `17`, `21`, `63`                         |
| VR-11 | Dashboard                | A brand-new site shows four large empty widgets, which take most of the first screen                          | Usability concern (low)                                        | UXI-04   | `10-dashboard.png`                             |
| VR-12 | Builder (Beginner)       | The "Want more control? Choose Designer…" tip takes the top of the Style panel on every visit until dismissed | Subjective                                                     | –        | `71-…`                                         |

## Checked and acceptable

- **Dark mode:** contrast and surfaces are consistent; no light-only artefacts were seen on Content, Products or Dashboard.
- **Empty states:** one consistent pattern across Dashboard, Products and Customers. Copy is concise.
- **Settings index:** dense, grouped and scannable. It does not wrap each option in heavy cards; this is a good example to keep.
- **Builder chrome:**
  - the canvas gets most of the width at 1440;
  - the top bar is compact;
  - the Style groups are collapsible.

## Not yet reviewed visually

- page editor;
- field picker;
- context menus;
- modals and confirm dialogs;
- media detail;
- focus states;
- hover states;
- RTL;
- 200% zoom.
