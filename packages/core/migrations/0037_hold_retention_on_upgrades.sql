-- An install that already has people on it was running before retention rules existed, so its
-- owner never chose them: every rule starts off until they do. A new install has no users yet
-- when this runs, and keeps the defaults. Someone who has already saved the setting keeps theirs.
INSERT INTO "settings" ("tenant_id", "key", "value")
SELECT 'default', 'privacy', '{"retention":{"formEntries":{"enabled":false,"days":365},"abandonedCarts":{"enabled":false,"days":30},"activityLogs":{"enabled":false,"days":90},"orders":{"enabled":false,"days":2555}},"processors":[],"retentionNeedsChoice":true}'::jsonb
WHERE EXISTS (SELECT 1 FROM "users")
ON CONFLICT DO NOTHING;
