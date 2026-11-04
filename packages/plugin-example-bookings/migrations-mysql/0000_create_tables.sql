CREATE TABLE `bookings` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`customer_name` longtext NOT NULL,
	`customer_email` longtext NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`duration_minutes` int NOT NULL,
	`notes` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bookings_tenant_starts_at_idx` ON `bookings` (`tenant_id`,`starts_at`);