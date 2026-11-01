/**
 * `@lintel/admin/plugin`: everything the admin half of a plugin needs, in one import.
 *
 *   import { defineAdminPlugin, Card, useCan } from "@lintel/admin/plugin";
 *
 * Plugin screens are built from the same components as Lintel's own, so they look and
 * behave the same in light and dark mode, by keyboard and with a screen reader. Anything
 * not exported here is internal to the admin and may change.
 */
export * from "./adminPlugin.js";
export { createTranslator } from "./createTranslator.js";
export { PluginBackLink, PluginLink, usePluginNavigate } from "./PluginLink.js";

// Talking to the API: the session cookie is sent, and failures carry a readable message.
export { ApiError, apiRequest, type FieldMessages } from "../api/client.js";
export { describeError } from "../api/describeError.js";
export { LoadError } from "../api/LoadError.js";

// Who is signed in, and what they may do.
export { useCan, useSession } from "../session/SessionContext.js";

// The design system (see packages/admin/src/design/README.md).
export { Badge } from "../design/Badge.js";
export { Button } from "../design/Button.js";
export { Card } from "../design/Card.js";
export { ConfirmDialog } from "../design/ConfirmDialog.js";
export { Dialog } from "../design/Dialog.js";
export { EmptyState } from "../design/EmptyState.js";
export { GroupedList } from "../design/GroupedList.js";
export { GroupedListRow } from "../design/GroupedListRow.js";
export { LargeTitle } from "../design/LargeTitle.js";
export { LoadingRegion } from "../design/LoadingRegion.js";
export { SegmentedControl } from "../design/SegmentedControl.js";
export { Skeleton } from "../design/Skeleton.js";
export { TextField } from "../design/TextField.js";
export { Toggle } from "../design/Toggle.js";
export { controlClasses } from "../design/controlStyles.js";
export { formatDateTime, formatRelativeTime } from "../content/relativeTime.js";
