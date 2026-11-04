CREATE TABLE `instagram_account` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`access_token` longtext NOT NULL,
	`instagram_user_id` longtext NOT NULL,
	`username` longtext NOT NULL,
	`token_refreshed_at` datetime(3) NOT NULL,
	`last_synced_at` datetime(3),
	`last_error` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `instagram_account_id` PRIMARY KEY(`id`),
	CONSTRAINT `instagram_account_tenant_idx` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `instagram_posts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`instagram_id` varchar(255) NOT NULL,
	`caption` longtext NOT NULL DEFAULT (''),
	`permalink` longtext NOT NULL,
	`media_type` longtext NOT NULL,
	`posted_at` datetime(3) NOT NULL,
	`image` longblob NOT NULL,
	`image_type` longtext NOT NULL,
	`alt_text` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `instagram_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `instagram_posts_tenant_instagram_id_idx` UNIQUE(`tenant_id`,`instagram_id`)
);
--> statement-breakpoint
CREATE INDEX `instagram_posts_tenant_posted_at_idx` ON `instagram_posts` (`tenant_id`,`posted_at`);