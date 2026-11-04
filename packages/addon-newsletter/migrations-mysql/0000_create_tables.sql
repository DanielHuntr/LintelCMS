CREATE TABLE `newsletter_connection` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`provider` longtext NOT NULL,
	`api_key` longtext NOT NULL,
	`list_id` longtext NOT NULL,
	`list_name` longtext NOT NULL DEFAULT (''),
	`double_opt_in` boolean NOT NULL DEFAULT true,
	`brevo_template_id` int,
	`brevo_confirm_url` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `newsletter_connection_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_connection_tenant_idx` UNIQUE(`tenant_id`)
);
