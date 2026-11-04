-- Written by hand: a layout belongs to a person or a role, never both. MySQL refuses a check on
-- columns with `on delete` rules (error 3823), but takes one on a column worked out from them.
-- This column isn't in Drizzle's tables, so no query reads or writes it.
UPDATE `dashboard_layouts` SET `role_id` = NULL WHERE `user_id` IS NOT NULL AND `role_id` IS NOT NULL;
--> statement-breakpoint
DELETE FROM `dashboard_layouts` WHERE `user_id` IS NULL AND `role_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `dashboard_layouts` ADD `owner_count` tinyint GENERATED ALWAYS AS ((`user_id` IS NOT NULL) + (`role_id` IS NOT NULL)) VIRTUAL;
--> statement-breakpoint
ALTER TABLE `dashboard_layouts` ADD CONSTRAINT `dashboard_layouts_one_owner` CHECK (`owner_count` = 1);
