# Dashboard

The home screen (`/`): each person's own arrangement of widgets, saved on the server
(see `packages/core/src/dashboard`).

## What people see

Their own layout if they have saved one, otherwise their role's default (set by an admin),
otherwise Lintel's default: every widget marked `onDefaultDashboard`, in list order.
Widgets they can't use are left out: a widget names a permission and, if it comes from a
plugin, needs that plugin switched on. A saved layout keeps hidden widgets at the end, so
they come back when the plugin does.

## Edit mode

**Edit dashboard** turns every widget into a preview with a drag handle, **Move earlier**
and **Move later** buttons (the keyboard way to reorder), a Small/Medium/Large control and
a remove button. **Add widget** opens a gallery of the rest; **Reset to default** removes
the person's own layout; **Default for a role…** (admins, `settings:update`) makes the
layout on screen the one a role starts from. **Done** saves; **Cancel** throws the changes
away. Every change is announced to screen readers.

Sizes are columns of a six-column grid: small 2, medium 3, large 6. Below about 670px of
width every widget takes the full row.

## Built-in widgets

| Id                     | Shows                                                                   | Needs          |
| ---------------------- | ----------------------------------------------------------------------- | -------------- |
| `core:welcome`         | A greeting and quick actions (new page, new post, upload)               | nothing        |
| `core:recent-edits`    | The six entries changed most recently, and by whom                      | `entries:read` |
| `core:my-edits`        | The six entries you changed most recently (also on the Content landing) | `entries:read` |
| `core:needs-attention` | Drafts and unpublished changes, oldest first                            | `entries:read` |
| `core:scheduled`       | What goes live by itself, soonest first                                 | `entries:read` |
| `core:media-usage`     | Files, space used, and images without alt text                          | `media:read`   |

Plugins add more with `dashboardWidgets`, and tabs beside the dashboard with
`dashboardTabs` (see `src/plugins`).

| File                                       | What it does                                           |
| ------------------------------------------ | ------------------------------------------------------ |
| `DashboardPage.tsx`                        | The screen, and Edit mode                              |
| `WidgetFrame.tsx`                          | One widget's card and its editing controls             |
| `WidgetGallery.tsx`                        | "Add a widget"                                         |
| `RoleDefaultDialog.tsx`                    | Setting and removing a role's default                  |
| `availableWidgets.ts`                      | Which widgets a person may use                         |
| `dashboardLayout.ts`                       | Moving, resizing, adding and removing (pure functions) |
| `widgets/`                                 | The built-in widgets                                   |
| `dashboard.api.ts`, `dashboard.queries.ts` | Calls to the API, and their caching                    |
