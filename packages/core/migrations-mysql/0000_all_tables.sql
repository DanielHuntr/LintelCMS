CREATE TABLE `analytics_daily` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36) NOT NULL,
	`day` varchar(16) NOT NULL,
	`dimension` varchar(64) NOT NULL,
	`key` varchar(500) NOT NULL DEFAULT '',
	`visitors` int NOT NULL DEFAULT 0,
	`views` int NOT NULL DEFAULT 0,
	`duration_ms` int NOT NULL DEFAULT 0,
	`duration_count` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`value` int NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `analytics_daily_unique` UNIQUE(`tenant_id`,`site_id`,`day`,`dimension`,`key`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36) NOT NULL,
	`occurred_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`day` varchar(16) NOT NULL,
	`kind` varchar(64) NOT NULL,
	`visitor_hash` longtext,
	`path` longtext NOT NULL DEFAULT (''),
	`source` longtext NOT NULL DEFAULT (''),
	`campaign` longtext NOT NULL DEFAULT (''),
	`device` varchar(64),
	`country` longtext NOT NULL DEFAULT (''),
	`duration_ms` int,
	`name` longtext NOT NULL DEFAULT (''),
	`value` int NOT NULL DEFAULT 0,
	`currency` longtext NOT NULL DEFAULT (''),
	`properties` json NOT NULL DEFAULT ('{}'),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_salts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`day` varchar(16) NOT NULL,
	`salt` longtext NOT NULL,
	CONSTRAINT `analytics_salts_id` PRIMARY KEY(`id`),
	CONSTRAINT `analytics_salts_tenant_day_unique` UNIQUE(`tenant_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `api_tokens` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`access` varchar(64) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`token_start` longtext NOT NULL,
	`created_by` varchar(36) NOT NULL,
	`last_used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `apps` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`manifest` json NOT NULL,
	`manifest_url` longtext,
	`scopes` json NOT NULL,
	`client_id` varchar(255) NOT NULL,
	`client_secret` longtext NOT NULL,
	`client_secret_hash` varchar(255) NOT NULL,
	`client_secret_start` longtext NOT NULL,
	`installed_by` varchar(36) NOT NULL,
	`last_used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `apps_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`),
	CONSTRAINT `apps_client_id_unique` UNIQUE(`client_id`),
	CONSTRAINT `apps_client_secret_hash_unique` UNIQUE(`client_secret_hash`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36),
	`filename` longtext NOT NULL,
	`storage_key` longtext NOT NULL,
	`mime_type` longtext NOT NULL,
	`size` int NOT NULL,
	`width` int,
	`height` int,
	`alt` longtext NOT NULL DEFAULT (''),
	`credit` longtext NOT NULL DEFAULT (''),
	`credit_details` json,
	`focal_x` float NOT NULL DEFAULT 0.5,
	`focal_y` float NOT NULL DEFAULT 0.5,
	`content_hash` varchar(255) NOT NULL,
	`uploaded_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_tenant_content_hash_unique` UNIQUE(`tenant_id`,`content_hash`)
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`filename` varchar(255) NOT NULL,
	`trigger` varchar(64) NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'running',
	`size` bigint,
	`checksum` longtext,
	`contents` json,
	`failure_reason` longtext,
	`created_by_name` longtext,
	`completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`),
	CONSTRAINT `backups_tenant_filename_unique` UNIQUE(`tenant_id`,`filename`)
);
--> statement-breakpoint
CREATE TABLE `binned_assets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`filename` longtext NOT NULL,
	`asset` json NOT NULL,
	`deleted_by` varchar(36),
	`deleted_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `binned_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`icon` longtext NOT NULL DEFAULT ('square'),
	`category` longtext NOT NULL DEFAULT (''),
	`description` longtext NOT NULL DEFAULT (''),
	`source` longtext NOT NULL DEFAULT ('site'),
	`properties` json NOT NULL DEFAULT ('[]'),
	`design` json,
	`template` longtext,
	`renamed_properties` json NOT NULL DEFAULT ('{}'),
	`variants` json NOT NULL DEFAULT ('{"properties":[],"looks":[],"clientsMayChoose":false}'),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocks_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `blueprints` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`kind` varchar(64) NOT NULL,
	`fields` json NOT NULL DEFAULT ('[]'),
	`version` int NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `blueprints_id` PRIMARY KEY(`id`),
	CONSTRAINT `blueprints_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `bridge_receipts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`target_id` varchar(36) NOT NULL,
	`item_id` varchar(255) NOT NULL,
	`kind` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `bridge_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bridge_receipts_item_unique` UNIQUE(`target_id`,`item_id`)
);
--> statement-breakpoint
CREATE TABLE `client_reviews` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`entry_id` varchar(36) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'waiting',
	`requested_by` varchar(36),
	`request_note` longtext NOT NULL DEFAULT (''),
	`decided_by` varchar(36),
	`decision_note` longtext NOT NULL DEFAULT (''),
	`decided_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `client_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`blueprint_id` varchar(36) NOT NULL,
	`route_pattern` longtext,
	`preview_url_pattern` longtext,
	`structure` varchar(64) NOT NULL DEFAULT 'flat',
	`site_scope` varchar(64) NOT NULL DEFAULT 'per-site',
	`site_ids` json,
	`allowed_at_root` boolean NOT NULL DEFAULT true,
	`allowed_children` json NOT NULL DEFAULT ('[]'),
	`children_as_collection` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `content_root_addresses` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`entry_id` varchar(36) NOT NULL,
	`hostname` longtext NOT NULL DEFAULT (''),
	`path_prefix` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `content_root_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_root_addresses_entry_unique` UNIQUE(`tenant_id`,`entry_id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_layouts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`user_id` varchar(36),
	`role_id` varchar(36),
	`widgets` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `dashboard_layouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_layouts_tenant_user_unique` UNIQUE(`tenant_id`,`user_id`),
	CONSTRAINT `dashboard_layouts_tenant_role_unique` UNIQUE(`tenant_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`collection_id` varchar(36) NOT NULL,
	`site_id` varchar(36) NOT NULL,
	`locale` varchar(255) NOT NULL DEFAULT 'en-GB',
	`origin_id` varchar(36),
	`parent_id` varchar(36),
	`slug` varchar(255) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'draft',
	`published_at` datetime(3),
	`scheduled_for` datetime(3),
	`data` json NOT NULL DEFAULT ('{}'),
	`published_data` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `entries_collection_site_locale_slug_unique` UNIQUE(`tenant_id`,`collection_id`,`site_id`,`locale`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `entry_seo` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`entry_id` varchar(36) NOT NULL,
	`title` longtext NOT NULL DEFAULT (''),
	`description` longtext NOT NULL DEFAULT (''),
	`social_image_id` varchar(36),
	`noindex` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `entry_seo_id` PRIMARY KEY(`id`),
	CONSTRAINT `entry_seo_tenant_entry_unique` UNIQUE(`tenant_id`,`entry_id`)
);
--> statement-breakpoint
CREATE TABLE `experiment_counts` (
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`experiment_id` varchar(36) NOT NULL,
	`version_key` varchar(255) NOT NULL,
	`day` date NOT NULL,
	`visitors` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	CONSTRAINT `experiment_counts_experiment_id_version_key_day_pk` PRIMARY KEY(`experiment_id`,`version_key`,`day`)
);
--> statement-breakpoint
CREATE TABLE `experiment_versions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`experiment_id` varchar(36) NOT NULL,
	`key` varchar(500) NOT NULL,
	`design` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `experiment_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `experiment_versions_key_idx` UNIQUE(`experiment_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`entry_id` varchar(36) NOT NULL,
	`scope` longtext NOT NULL,
	`section_id` longtext,
	`status` varchar(255) NOT NULL DEFAULT 'draft',
	`goal` json,
	`split` json NOT NULL,
	`secret` longtext NOT NULL,
	`winner` longtext,
	`started_at` datetime(3),
	`ended_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fieldsets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`fields` json NOT NULL DEFAULT ('[]'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `fieldsets_id` PRIMARY KEY(`id`),
	CONSTRAINT `fieldsets_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `form_submission_notes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`submission_id` varchar(36) NOT NULL,
	`author_id` varchar(36),
	`body` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `form_submission_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`form_id` varchar(36) NOT NULL,
	`values` json NOT NULL,
	`submitter_email` varchar(255),
	`asset_ids` json NOT NULL DEFAULT ('[]'),
	`source_url` longtext,
	`consents` json NOT NULL DEFAULT ('[]'),
	`token_hash` varchar(255),
	`is_read` boolean NOT NULL DEFAULT false,
	`is_starred` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`fields` json NOT NULL,
	`submit_label` longtext NOT NULL,
	`confirmation` json NOT NULL,
	`notifications` json NOT NULL,
	`retention_days` int,
	`accepting_submissions` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `forms_tenant_handle_idx` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `global_sets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`fields` json NOT NULL DEFAULT ('[]'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `global_sets_id` PRIMARY KEY(`id`),
	CONSTRAINT `global_sets_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `global_values` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`global_set_id` varchar(36) NOT NULL,
	`site_id` varchar(36) NOT NULL,
	`locale` varchar(255) NOT NULL,
	`data` json NOT NULL DEFAULT ('{}'),
	`updated_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `global_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `global_values_set_site_locale_unique` UNIQUE(`global_set_id`,`site_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`email` varchar(255) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	`invited_by` varchar(36),
	`token_hash` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_tenant_email_unique` UNIQUE(`tenant_id`,`email`),
	CONSTRAINT `invitations_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `navigations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36) NOT NULL,
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`max_depth` int NOT NULL DEFAULT 3,
	`items` json NOT NULL DEFAULT ('[]'),
	`source` varchar(64) NOT NULL DEFAULT 'items',
	`page_tree` json NOT NULL DEFAULT ('{"includeHome":true,"hiddenEntryIds":[],"labels":{}}'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `navigations_id` PRIMARY KEY(`id`),
	CONSTRAINT `navigations_site_handle_unique` UNIQUE(`tenant_id`,`site_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `one_time_tokens` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`purpose` varchar(255) NOT NULL,
	`user_id` varchar(36),
	`token_hash` varchar(255) NOT NULL,
	`details` json NOT NULL DEFAULT ('{}'),
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `one_time_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `one_time_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`user_id` varchar(36) NOT NULL,
	`name` longtext NOT NULL,
	`credential_id` varchar(700) NOT NULL,
	`public_key` longtext NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`transports` json NOT NULL DEFAULT ('[]'),
	`last_used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `passkeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkeys_credential_id_unique` UNIQUE(`credential_id`)
);
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`kind` varchar(64) NOT NULL,
	`actor_id` varchar(36),
	`actor_name` longtext NOT NULL DEFAULT (''),
	`parts` json NOT NULL DEFAULT ('[]'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `privacy_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publish_runs` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`target_id` varchar(36) NOT NULL,
	`trigger` varchar(64) NOT NULL,
	`status` varchar(64) NOT NULL DEFAULT 'running',
	`dry_run` boolean NOT NULL DEFAULT false,
	`summary` json,
	`error_message` longtext,
	`started_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`finished_at` datetime(3),
	CONSTRAINT `publish_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publish_targets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`site_id` varchar(36),
	`kind` varchar(64) NOT NULL,
	`options` json NOT NULL DEFAULT ('{}'),
	`sealed_secrets` longtext,
	`form_delivery` varchar(64) NOT NULL DEFAULT 'bridge',
	`publish_automatically` boolean NOT NULL DEFAULT false,
	`delete_limit` int NOT NULL DEFAULT 50,
	`last_published_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `publish_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recovery_codes` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`user_id` varchar(36) NOT NULL,
	`code_hash` longtext NOT NULL,
	`used_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recycle_bin_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`entry_id` varchar(36) NOT NULL,
	`collection_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`title` longtext NOT NULL,
	`item_count` int NOT NULL,
	`branch` json NOT NULL,
	`deleted_by` varchar(36),
	`deleted_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `recycle_bin_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`from_path` varchar(700) NOT NULL,
	`to_path` longtext NOT NULL,
	`status_code` int NOT NULL DEFAULT 301,
	`status` varchar(255) NOT NULL DEFAULT 'active',
	`source` varchar(64) NOT NULL DEFAULT 'manual',
	`entry_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `redirects_tenant_from_unique` UNIQUE(`tenant_id`,`from_path`)
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`entry_id` varchar(36) NOT NULL,
	`author_id` varchar(36),
	`kind` varchar(64) NOT NULL DEFAULT 'edited',
	`data` json NOT NULL,
	`is_open` boolean NOT NULL DEFAULT false,
	`restored_from_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`description` longtext NOT NULL DEFAULT (''),
	`is_built_in` boolean NOT NULL DEFAULT false,
	`requires_two_factor` boolean NOT NULL DEFAULT false,
	`permissions` json NOT NULL DEFAULT ('[]'),
	`site_ids` json,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`kind` varchar(255) NOT NULL,
	`actor_id` varchar(36),
	`actor_email` longtext,
	`subject_id` varchar(36),
	`subject_name` longtext,
	`ip_address` longtext,
	`user_agent` longtext,
	`details` json NOT NULL DEFAULT ('{}'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`user_id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`last_used_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`user_agent` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`key` varchar(500) NOT NULL,
	`value` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_tenant_key_unique` UNIQUE(`tenant_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `site_fonts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36) NOT NULL,
	`family` varchar(255) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'sans',
	`source` varchar(64) NOT NULL,
	`source_id` longtext,
	`files` json NOT NULL DEFAULT ('[]'),
	`licence_confirmed_at` datetime(3),
	`licence_confirmed_by` varchar(36),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `site_fonts_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_fonts_site_family_unique` UNIQUE(`tenant_id`,`site_id`,`family`)
);
--> statement-breakpoint
CREATE TABLE `site_import_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`import_id` varchar(36) NOT NULL,
	`kind` varchar(255) NOT NULL,
	`source_id` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`target_id` varchar(36),
	`message` longtext,
	`details` json,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `site_import_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_import_items_source_unique` UNIQUE(`import_id`,`kind`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `site_imports` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`source` varchar(64) NOT NULL,
	`filename` longtext NOT NULL,
	`site_title` longtext NOT NULL DEFAULT (''),
	`site_address` longtext NOT NULL DEFAULT (''),
	`status` varchar(64) NOT NULL DEFAULT 'ready',
	`found` json NOT NULL,
	`mapping` json,
	`media_hosts` json NOT NULL DEFAULT ('[]'),
	`progress` json NOT NULL DEFAULT ('{"done":0,"total":0}'),
	`archive_file` longtext,
	`started_by` varchar(36),
	`last_error` longtext,
	`completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `site_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_locales` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`site_id` varchar(36) NOT NULL,
	`code` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `site_locales_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_locales_site_code_unique` UNIQUE(`site_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`domain` longtext NOT NULL,
	`hostnames` json NOT NULL DEFAULT ('[]'),
	`path_prefix` longtext NOT NULL DEFAULT (''),
	`site_url` longtext NOT NULL DEFAULT (''),
	`locale` longtext NOT NULL DEFAULT ('en-GB'),
	`fallback_locale` longtext,
	`branding` json NOT NULL DEFAULT ('{"logoAssetId":null,"accentColor":null}'),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `sites_id` PRIMARY KEY(`id`),
	CONSTRAINT `sites_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `taxonomies` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`site_id` varchar(36),
	`handle` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `taxonomies_id` PRIMARY KEY(`id`),
	CONSTRAINT `taxonomies_tenant_handle_unique` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`taxonomy_id` varchar(36) NOT NULL,
	`title` longtext NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `terms_taxonomy_slug_unique` UNIQUE(`tenant_id`,`taxonomy_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `two_factor` (
	`user_id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`secret` longtext,
	`pending_secret` longtext,
	`enabled_at` datetime(3),
	`last_used_step` int,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `two_factor_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_interface_languages` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`user_id` varchar(36) NOT NULL,
	`language` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `user_interface_languages_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_interface_languages_user_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_notifications` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`user_id` varchar(36) NOT NULL,
	`message` longtext NOT NULL,
	`link` longtext,
	`read_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `user_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` varchar(36) NOT NULL,
	`role_id` varchar(36) NOT NULL,
	CONSTRAINT `user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`email` varchar(255) NOT NULL,
	`name` longtext NOT NULL,
	`password_hash` longtext,
	`last_signed_in_at` datetime(3),
	`status` varchar(64) NOT NULL DEFAULT 'active',
	`deactivated_at` datetime(3),
	`avatar_asset_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_tenant_email_unique` UNIQUE(`tenant_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`webhook_id` varchar(36) NOT NULL,
	`event` longtext NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`next_attempt_at` datetime(3),
	`last_attempt_at` datetime(3),
	`response_status` int,
	`response_summary` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`url` longtext NOT NULL,
	`events` json NOT NULL,
	`secret` longtext NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_by` varchar(36),
	`app_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wordpress_import_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`import_id` varchar(36) NOT NULL,
	`kind` varchar(255) NOT NULL,
	`source_id` varchar(255) NOT NULL,
	`position` int NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`target_id` varchar(36),
	`message` longtext,
	`details` json,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `wordpress_import_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `wordpress_import_items_source_unique` UNIQUE(`import_id`,`kind`,`source_id`)
);
--> statement-breakpoint
CREATE TABLE `wordpress_imports` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`filename` longtext NOT NULL,
	`site_title` longtext NOT NULL DEFAULT (''),
	`site_address` longtext NOT NULL DEFAULT (''),
	`status` varchar(64) NOT NULL DEFAULT 'ready',
	`found` json NOT NULL,
	`mapping` json,
	`progress` json NOT NULL DEFAULT ('{"done":0,"total":0}'),
	`content_zip_file` longtext,
	`started_by` varchar(36),
	`last_error` longtext,
	`completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `wordpress_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_approvals` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`run_id` varchar(36) NOT NULL,
	`step_id` varchar(255) NOT NULL,
	`role` longtext NOT NULL,
	`message` longtext NOT NULL DEFAULT (''),
	`entry_id` varchar(36),
	`requested_by` varchar(36),
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`decided_by` varchar(36),
	`comment` longtext,
	`decided_at` datetime(3),
	`expires_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `workflow_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_approvals_run_step_unique` UNIQUE(`run_id`,`step_id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`workflow_id` varchar(36) NOT NULL,
	`workflow_name` longtext NOT NULL,
	`definition` json NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'queued',
	`context` json NOT NULL,
	`step_states` json NOT NULL DEFAULT ('{}'),
	`idempotency_key` varchar(255),
	`is_test` boolean NOT NULL DEFAULT false,
	`depth` int NOT NULL DEFAULT 0,
	`entry_id` varchar(36),
	`started_by` varchar(36),
	`next_run_at` datetime(3),
	`lease_until` datetime(3),
	`error` longtext,
	`finished_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `workflow_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflow_runs_idempotency_unique` UNIQUE(`workflow_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `workflow_step_logs` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`run_id` varchar(36) NOT NULL,
	`step_id` longtext NOT NULL,
	`step_type` longtext NOT NULL,
	`status` varchar(64) NOT NULL,
	`summary` longtext NOT NULL,
	`detail` json,
	`attempt` int NOT NULL DEFAULT 1,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `workflow_step_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`description` longtext NOT NULL DEFAULT (''),
	`enabled` boolean NOT NULL DEFAULT true,
	`trigger` json NOT NULL,
	`steps` json NOT NULL,
	`secret` longtext NOT NULL,
	`purpose` longtext,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_archived_orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`source` varchar(255) NOT NULL DEFAULT 'shopify',
	`name` varchar(255) NOT NULL,
	`email` longtext NOT NULL DEFAULT (''),
	`customer_id` varchar(36),
	`currency` longtext NOT NULL,
	`subtotal_amount` int NOT NULL DEFAULT 0,
	`discount_amount` int NOT NULL DEFAULT 0,
	`shipping_amount` int NOT NULL DEFAULT 0,
	`tax_amount` int NOT NULL DEFAULT 0,
	`total_amount` int NOT NULL DEFAULT 0,
	`refunded_amount` int NOT NULL DEFAULT 0,
	`payment_status` longtext NOT NULL DEFAULT (''),
	`fulfilment_status` longtext NOT NULL DEFAULT (''),
	`discount_codes` json NOT NULL DEFAULT ('[]'),
	`lines` json NOT NULL DEFAULT ('[]'),
	`shipping_address` json,
	`placed_at` datetime(3) NOT NULL,
	`cancelled_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_archived_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_archived_orders_name_idx` UNIQUE(`tenant_id`,`source`,`name`)
);
--> statement-breakpoint
CREATE TABLE `shop_cart_lines` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`cart_id` varchar(36) NOT NULL,
	`variant_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_cart_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_cart_lines_variant_idx` UNIQUE(`cart_id`,`variant_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_carts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`token_hash` varchar(255) NOT NULL,
	`market_id` varchar(36) NOT NULL,
	`country` longtext,
	`email` longtext,
	`shipping_address` json,
	`shipping_rate_id` varchar(36),
	`discount_codes` json NOT NULL DEFAULT ('[]'),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_carts_token_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `shop_checkouts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`cart_id` varchar(36),
	`market_id` varchar(36) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'open',
	`email` longtext NOT NULL,
	`shipping_address` json NOT NULL,
	`currency` longtext NOT NULL,
	`lines` json NOT NULL,
	`shipping_line` json NOT NULL,
	`discounts` json NOT NULL DEFAULT ('[]'),
	`subtotal_amount` int NOT NULL,
	`discount_amount` int NOT NULL,
	`shipping_amount` int NOT NULL,
	`tax_amount` int NOT NULL,
	`total_amount` int NOT NULL,
	`taxes_included` boolean NOT NULL,
	`tax_calculation` longtext NOT NULL,
	`tax_reference` longtext,
	`payment_provider` varchar(64) NOT NULL DEFAULT 'stripe',
	`provider_payment_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` longtext,
	`problem` longtext,
	`expires_at` datetime(3) NOT NULL,
	`order_id` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_checkouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_customers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`email` varchar(255) NOT NULL,
	`name` longtext NOT NULL DEFAULT (''),
	`phone` longtext NOT NULL DEFAULT (''),
	`addresses` json NOT NULL DEFAULT ('[]'),
	`note` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_customers_email_idx` UNIQUE(`tenant_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `shop_discount_redemptions` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`discount_id` varchar(36) NOT NULL,
	`checkout_id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`email` varchar(255) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'held',
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_discount_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_discount_redemptions_checkout_idx` UNIQUE(`discount_id`,`checkout_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_discounts` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`title` longtext NOT NULL,
	`method` varchar(255) NOT NULL,
	`code` varchar(255),
	`kind` varchar(64) NOT NULL,
	`percent_off` int NOT NULL DEFAULT 0,
	`amounts` json NOT NULL DEFAULT ('{}'),
	`buy_quantity` int NOT NULL DEFAULT 0,
	`get_quantity` int NOT NULL DEFAULT 0,
	`scope` varchar(64) NOT NULL DEFAULT 'order',
	`product_ids` json NOT NULL DEFAULT ('[]'),
	`collection_ids` json NOT NULL DEFAULT ('[]'),
	`minimum_spend` json NOT NULL DEFAULT ('{}'),
	`minimum_quantity` int,
	`starts_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`ends_at` datetime(3),
	`usage_limit` int,
	`per_customer_limit` int,
	`combines_with_others` boolean NOT NULL DEFAULT true,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_discounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_discounts_code_idx` UNIQUE(`tenant_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `shop_fulfilments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`order_id` varchar(36) NOT NULL,
	`lines` json NOT NULL,
	`tracking_company` longtext NOT NULL DEFAULT (''),
	`tracking_number` longtext NOT NULL DEFAULT (''),
	`tracking_url` longtext NOT NULL DEFAULT (''),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_fulfilments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_inventory_levels` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`variant_id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`on_hand` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_inventory_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_inventory_levels_variant_idx` UNIQUE(`variant_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_inventory_locations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_inventory_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_inventory_reservations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`variant_id` varchar(36) NOT NULL,
	`checkout_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'active',
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_inventory_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_markets` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`handle` varchar(255) NOT NULL,
	`currency` longtext NOT NULL,
	`countries` json NOT NULL DEFAULT ('[]'),
	`is_primary` boolean NOT NULL DEFAULT false,
	`exchange_rate` double NOT NULL DEFAULT 1,
	`price_rounding` varchar(64) NOT NULL DEFAULT 'exact',
	`prices_include_tax` boolean NOT NULL DEFAULT true,
	`payment_provider` varchar(64),
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_markets_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_markets_handle_idx` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `shop_order_events` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`order_id` varchar(36) NOT NULL,
	`kind` longtext NOT NULL,
	`message` longtext NOT NULL,
	`data` json NOT NULL DEFAULT ('{}'),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_order_lines` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`order_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`product_id` varchar(36),
	`product_title` longtext NOT NULL,
	`variant_title` longtext NOT NULL,
	`sku` longtext,
	`image_id` varchar(36),
	`quantity` int NOT NULL,
	`unit_amount` int NOT NULL,
	`subtotal_amount` int NOT NULL,
	`discount_amount` int NOT NULL,
	`tax_amount` int NOT NULL,
	`weight_grams` int NOT NULL DEFAULT 0,
	`fulfilled_quantity` int NOT NULL DEFAULT 0,
	`refunded_quantity` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `shop_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`number` int NOT NULL,
	`name` longtext NOT NULL,
	`checkout_id` varchar(36) NOT NULL,
	`customer_id` varchar(36),
	`email` longtext NOT NULL,
	`market_id` varchar(36),
	`currency` longtext NOT NULL,
	`shipping_address` json NOT NULL,
	`shipping_line` json NOT NULL,
	`discounts` json NOT NULL DEFAULT ('[]'),
	`subtotal_amount` int NOT NULL,
	`discount_amount` int NOT NULL,
	`shipping_amount` int NOT NULL,
	`tax_amount` int NOT NULL,
	`total_amount` int NOT NULL,
	`refunded_amount` int NOT NULL DEFAULT 0,
	`taxes_included` boolean NOT NULL,
	`payment_status` varchar(64) NOT NULL DEFAULT 'paid',
	`fulfilment_status` varchar(64) NOT NULL DEFAULT 'unfulfilled',
	`payment_provider` varchar(64) NOT NULL DEFAULT 'stripe',
	`provider_payment_id` longtext,
	`stripe_payment_intent_id` varchar(255),
	`is_test` boolean NOT NULL DEFAULT false,
	`paid_at` datetime(3) NOT NULL,
	`cancelled_at` datetime(3),
	`cancel_reason` longtext,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_orders_number_idx` UNIQUE(`tenant_id`,`number`),
	CONSTRAINT `shop_orders_checkout_idx` UNIQUE(`checkout_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_payment_accounts` (
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`provider` varchar(255) NOT NULL,
	`credentials` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_payment_accounts_tenant_id_provider_pk` PRIMARY KEY(`tenant_id`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `shop_payment_events` (
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`provider` varchar(255) NOT NULL,
	`event_id` varchar(255) NOT NULL,
	`type` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_payment_events_provider_event_id_pk` PRIMARY KEY(`provider`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_product_collection_items` (
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`collection_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `shop_product_collection_items_collection_id_product_id_pk` PRIMARY KEY(`collection_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_product_collections` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`title` longtext NOT NULL,
	`handle` varchar(255) NOT NULL,
	`description` longtext NOT NULL DEFAULT (''),
	`kind` varchar(64) NOT NULL DEFAULT 'manual',
	`rules` json NOT NULL DEFAULT ('[]'),
	`match_all` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_product_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_product_collections_handle_idx` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `shop_products` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`title` longtext NOT NULL,
	`handle` varchar(255) NOT NULL,
	`description` json,
	`status` varchar(255) NOT NULL DEFAULT 'draft',
	`vendor` longtext NOT NULL DEFAULT (''),
	`product_type` longtext NOT NULL DEFAULT (''),
	`tags` json NOT NULL DEFAULT ('[]'),
	`media_ids` json NOT NULL DEFAULT ('[]'),
	`options` json NOT NULL DEFAULT ('[]'),
	`seo_title` longtext NOT NULL DEFAULT (''),
	`seo_description` longtext NOT NULL DEFAULT (''),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_products_handle_idx` UNIQUE(`tenant_id`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `shop_refunds` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`order_id` varchar(36) NOT NULL,
	`amount` int NOT NULL,
	`currency` longtext NOT NULL,
	`reason` longtext NOT NULL DEFAULT (''),
	`status` varchar(64) NOT NULL DEFAULT 'pending',
	`lines` json NOT NULL DEFAULT ('[]'),
	`restock` boolean NOT NULL DEFAULT false,
	`notify_customer` boolean NOT NULL DEFAULT true,
	`stripe_refund_id` varchar(255),
	`provider_refund_id` varchar(255),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_refunds_stripe_idx` UNIQUE(`stripe_refund_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_shipping_rates` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`zone_id` varchar(36) NOT NULL,
	`name` longtext NOT NULL,
	`kind` varchar(64) NOT NULL DEFAULT 'flat',
	`amounts` json NOT NULL DEFAULT ('{}'),
	`weight_brackets` json NOT NULL DEFAULT ('[]'),
	`free_over_amounts` json,
	`delivery_estimate` longtext NOT NULL DEFAULT (''),
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_shipping_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_shipping_zones` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` longtext NOT NULL,
	`countries` json NOT NULL DEFAULT ('[]'),
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_shipping_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`shop_name` longtext NOT NULL DEFAULT (''),
	`support_email` longtext NOT NULL DEFAULT (''),
	`tax_calculation` varchar(64) NOT NULL DEFAULT 'stripe',
	`manual_tax_rates` json NOT NULL DEFAULT ('[]'),
	`tax_shipping` boolean NOT NULL DEFAULT true,
	`checkout_mode` varchar(64) NOT NULL DEFAULT 'hosted',
	`stripe_secret_key` longtext,
	`stripe_publishable_key` longtext,
	`stripe_webhook_secret` longtext,
	`stripe_events_checked_until` datetime(3),
	`stripe_last_webhook_at` datetime(3),
	`order_number_prefix` longtext NOT NULL DEFAULT ('#'),
	`next_order_number` int NOT NULL DEFAULT 1001,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_settings_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `shop_shopify_imports` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`status` varchar(64) NOT NULL DEFAULT 'ready',
	`plan` json NOT NULL,
	`options` json NOT NULL,
	`stage` varchar(64) NOT NULL DEFAULT 'products',
	`position` int NOT NULL DEFAULT 0,
	`report` json NOT NULL,
	`dry_run_report` json,
	`lease_until` datetime(3),
	`completed_at` datetime(3),
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_shopify_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_stripe_events` (
	`id` varchar(255) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`type` longtext NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_variant_prices` (
	`id` varchar(36) NOT NULL,
	`tenant_id` longtext NOT NULL DEFAULT ('default'),
	`variant_id` varchar(36) NOT NULL,
	`currency` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`compare_at_amount` int,
	CONSTRAINT `shop_variant_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_variant_prices_currency_idx` UNIQUE(`variant_id`,`currency`)
);
--> statement-breakpoint
CREATE TABLE `shop_variants` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT 'default',
	`product_id` varchar(36) NOT NULL,
	`title` longtext NOT NULL,
	`option_values` json NOT NULL DEFAULT ('[]'),
	`sku` varchar(255),
	`barcode` longtext,
	`weight_grams` int NOT NULL DEFAULT 0,
	`inventory_tracked` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (current_timestamp(3)),
	CONSTRAINT `shop_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_variants_sku_idx` UNIQUE(`tenant_id`,`sku`)
);
--> statement-breakpoint
ALTER TABLE `analytics_daily` ADD CONSTRAINT `analytics_daily_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_tokens` ADD CONSTRAINT `api_tokens_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `apps` ADD CONSTRAINT `apps_installed_by_users_id_fk` FOREIGN KEY (`installed_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `binned_assets` ADD CONSTRAINT `binned_assets_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bridge_receipts` ADD CONSTRAINT `bridge_receipts_target_id_publish_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `publish_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_reviews` ADD CONSTRAINT `client_reviews_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_reviews` ADD CONSTRAINT `client_reviews_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_reviews` ADD CONSTRAINT `client_reviews_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collections` ADD CONSTRAINT `collections_blueprint_id_blueprints_id_fk` FOREIGN KEY (`blueprint_id`) REFERENCES `blueprints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_root_addresses` ADD CONSTRAINT `content_root_addresses_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dashboard_layouts` ADD CONSTRAINT `dashboard_layouts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dashboard_layouts` ADD CONSTRAINT `dashboard_layouts_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_origin_id_entries_id_fk` FOREIGN KEY (`origin_id`) REFERENCES `entries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_parent_id_entries_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `entries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entries` ADD CONSTRAINT `entries_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_seo` ADD CONSTRAINT `entry_seo_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entry_seo` ADD CONSTRAINT `entry_seo_social_image_id_assets_id_fk` FOREIGN KEY (`social_image_id`) REFERENCES `assets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experiment_counts` ADD CONSTRAINT `experiment_counts_experiment_id_experiments_id_fk` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experiment_versions` ADD CONSTRAINT `experiment_versions_experiment_id_experiments_id_fk` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `experiments` ADD CONSTRAINT `experiments_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission_notes` ADD CONSTRAINT `form_submission_notes_submission_id_form_submissions_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `form_submissions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submission_notes` ADD CONSTRAINT `form_submission_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `form_submissions` ADD CONSTRAINT `form_submissions_form_id_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `forms` ADD CONSTRAINT `forms_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `global_values` ADD CONSTRAINT `global_values_global_set_id_global_sets_id_fk` FOREIGN KEY (`global_set_id`) REFERENCES `global_sets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `global_values` ADD CONSTRAINT `global_values_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `global_values` ADD CONSTRAINT `global_values_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `navigations` ADD CONSTRAINT `navigations_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `one_time_tokens` ADD CONSTRAINT `one_time_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `passkeys` ADD CONSTRAINT `passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `privacy_requests` ADD CONSTRAINT `privacy_requests_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publish_runs` ADD CONSTRAINT `publish_runs_target_id_publish_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `publish_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `publish_targets` ADD CONSTRAINT `publish_targets_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recycle_bin_items` ADD CONSTRAINT `recycle_bin_items_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recycle_bin_items` ADD CONSTRAINT `recycle_bin_items_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `redirects` ADD CONSTRAINT `redirects_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_subject_id_users_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_fonts` ADD CONSTRAINT `site_fonts_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_import_items` ADD CONSTRAINT `site_import_items_import_id_site_imports_id_fk` FOREIGN KEY (`import_id`) REFERENCES `site_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_locales` ADD CONSTRAINT `site_locales_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxonomies` ADD CONSTRAINT `taxonomies_site_id_sites_id_fk` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `terms` ADD CONSTRAINT `terms_taxonomy_id_taxonomies_id_fk` FOREIGN KEY (`taxonomy_id`) REFERENCES `taxonomies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `two_factor` ADD CONSTRAINT `two_factor_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_interface_languages` ADD CONSTRAINT `user_interface_languages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notifications` ADD CONSTRAINT `user_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_avatar_asset_id_assets_id_fk` FOREIGN KEY (`avatar_asset_id`) REFERENCES `assets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_id_webhooks_id_fk` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_app_id_apps_id_fk` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wordpress_import_items` ADD CONSTRAINT `wordpress_import_items_import_id_wordpress_imports_id_fk` FOREIGN KEY (`import_id`) REFERENCES `wordpress_imports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_approvals` ADD CONSTRAINT `workflow_approvals_run_id_workflow_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_approvals` ADD CONSTRAINT `workflow_approvals_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_approvals` ADD CONSTRAINT `workflow_approvals_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_workflow_id_workflows_id_fk` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD CONSTRAINT `workflow_runs_started_by_users_id_fk` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_step_logs` ADD CONSTRAINT `workflow_step_logs_run_id_workflow_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflows` ADD CONSTRAINT `workflows_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_archived_orders` ADD CONSTRAINT `shop_archived_orders_customer_id_shop_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_cart_lines` ADD CONSTRAINT `shop_cart_lines_cart_id_shop_carts_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `shop_carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_cart_lines` ADD CONSTRAINT `shop_cart_lines_variant_id_shop_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `shop_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_carts` ADD CONSTRAINT `shop_carts_market_id_shop_markets_id_fk` FOREIGN KEY (`market_id`) REFERENCES `shop_markets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_discount_redemptions` ADD CONSTRAINT `shop_discount_redemptions_discount_id_shop_discounts_id_fk` FOREIGN KEY (`discount_id`) REFERENCES `shop_discounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_fulfilments` ADD CONSTRAINT `shop_fulfilments_order_id_shop_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_fulfilments` ADD CONSTRAINT `shop_fulfilments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_inventory_levels` ADD CONSTRAINT `shop_inventory_levels_variant_id_shop_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `shop_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_inventory_levels` ADD CONSTRAINT `shop_inventory_levels_location_id_shop_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `shop_inventory_locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_inventory_reservations` ADD CONSTRAINT `shop_inventory_reservations_variant_id_shop_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `shop_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_inventory_reservations` ADD CONSTRAINT `shop_inventory_reservations_checkout_id_shop_checkouts_id_fk` FOREIGN KEY (`checkout_id`) REFERENCES `shop_checkouts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_order_events` ADD CONSTRAINT `shop_order_events_order_id_shop_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_order_events` ADD CONSTRAINT `shop_order_events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_order_lines` ADD CONSTRAINT `shop_order_lines_order_id_shop_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_orders` ADD CONSTRAINT `shop_orders_customer_id_shop_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_product_collection_items` ADD CONSTRAINT `shop_product_collection_items_collection_id_shop_produc_7a74904e` FOREIGN KEY (`collection_id`) REFERENCES `shop_product_collections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_product_collection_items` ADD CONSTRAINT `shop_product_collection_items_product_id_shop_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `shop_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_refunds` ADD CONSTRAINT `shop_refunds_order_id_shop_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_refunds` ADD CONSTRAINT `shop_refunds_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_shipping_rates` ADD CONSTRAINT `shop_shipping_rates_zone_id_shop_shipping_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `shop_shipping_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_shopify_imports` ADD CONSTRAINT `shop_shopify_imports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_variant_prices` ADD CONSTRAINT `shop_variant_prices_variant_id_shop_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `shop_variants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shop_variants` ADD CONSTRAINT `shop_variants_product_id_shop_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `shop_products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `analytics_events_site_day_idx` ON `analytics_events` (`tenant_id`,`site_id`,`day`);--> statement-breakpoint
CREATE INDEX `analytics_events_occurred_idx` ON `analytics_events` (`tenant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `api_tokens_tenant_created_idx` ON `api_tokens` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `apps_tenant_created_idx` ON `apps` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `assets_tenant_created_idx` ON `assets` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `backups_tenant_created_idx` ON `backups` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `binned_assets_tenant_deleted_idx` ON `binned_assets` (`tenant_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `client_reviews_entry_idx` ON `client_reviews` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `client_reviews_status_idx` ON `client_reviews` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `entries_collection_site_idx` ON `entries` (`collection_id`,`site_id`);--> statement-breakpoint
CREATE INDEX `entries_origin_idx` ON `entries` (`origin_id`);--> statement-breakpoint
CREATE INDEX `entries_parent_sort_idx` ON `entries` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `entries_status_scheduled_for_idx` ON `entries` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `experiments_tenant_entry_idx` ON `experiments` (`tenant_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `experiments_tenant_status_idx` ON `experiments` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `form_submission_notes_submission_idx` ON `form_submission_notes` (`submission_id`);--> statement-breakpoint
CREATE INDEX `form_submissions_form_idx` ON `form_submissions` (`form_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_submissions_token_idx` ON `form_submissions` (`form_id`,`token_hash`);--> statement-breakpoint
CREATE INDEX `form_submissions_email_idx` ON `form_submissions` (`tenant_id`,`submitter_email`);--> statement-breakpoint
CREATE INDEX `invitations_tenant_created_idx` ON `invitations` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `one_time_tokens_user_purpose_idx` ON `one_time_tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `privacy_requests_tenant_created_idx` ON `privacy_requests` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `publish_runs_target_idx` ON `publish_runs` (`tenant_id`,`target_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `publish_targets_tenant_idx` ON `publish_targets` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `recovery_codes_user_idx` ON `recovery_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `recycle_bin_items_tenant_deleted_idx` ON `recycle_bin_items` (`tenant_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `redirects_tenant_status_idx` ON `redirects` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `revisions_entry_idx` ON `revisions` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_tenant_created_idx` ON `security_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_actor_kind_idx` ON `security_events` (`actor_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `site_import_items_position_idx` ON `site_import_items` (`import_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `site_imports_tenant_created_idx` ON `site_imports` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `terms_taxonomy_idx` ON `terms` (`taxonomy_id`);--> statement-breakpoint
CREATE INDEX `user_notifications_user_idx` ON `user_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_idx` ON `webhook_deliveries` (`webhook_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_due_idx` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `webhooks_tenant_idx` ON `webhooks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `webhooks_app_idx` ON `webhooks` (`app_id`);--> statement-breakpoint
CREATE INDEX `wordpress_import_items_position_idx` ON `wordpress_import_items` (`import_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `wordpress_imports_tenant_created_idx` ON `wordpress_imports` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workflow_approvals_entry_idx` ON `workflow_approvals` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workflow_approvals_status_idx` ON `workflow_approvals` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `workflow_runs_workflow_idx` ON `workflow_runs` (`workflow_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workflow_runs_due_idx` ON `workflow_runs` (`status`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `workflow_runs_entry_idx` ON `workflow_runs` (`entry_id`);--> statement-breakpoint
CREATE INDEX `workflow_step_logs_run_idx` ON `workflow_step_logs` (`run_id`,`position`);--> statement-breakpoint
CREATE INDEX `workflows_tenant_idx` ON `workflows` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `shop_archived_orders_customer_idx` ON `shop_archived_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `shop_archived_orders_placed_idx` ON `shop_archived_orders` (`tenant_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `shop_cart_lines_cart_idx` ON `shop_cart_lines` (`cart_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shop_checkouts_status_idx` ON `shop_checkouts` (`tenant_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `shop_checkouts_session_idx` ON `shop_checkouts` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `shop_checkouts_provider_payment_idx` ON `shop_checkouts` (`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `shop_discount_redemptions_discount_idx` ON `shop_discount_redemptions` (`discount_id`,`status`);--> statement-breakpoint
CREATE INDEX `shop_discount_redemptions_email_idx` ON `shop_discount_redemptions` (`discount_id`,`email`);--> statement-breakpoint
CREATE INDEX `shop_discounts_method_idx` ON `shop_discounts` (`tenant_id`,`method`,`enabled`);--> statement-breakpoint
CREATE INDEX `shop_fulfilments_order_idx` ON `shop_fulfilments` (`order_id`);--> statement-breakpoint
CREATE INDEX `shop_inventory_locations_tenant_idx` ON `shop_inventory_locations` (`tenant_id`,`position`);--> statement-breakpoint
CREATE INDEX `shop_inventory_reservations_variant_idx` ON `shop_inventory_reservations` (`variant_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `shop_inventory_reservations_checkout_idx` ON `shop_inventory_reservations` (`checkout_id`);--> statement-breakpoint
CREATE INDEX `shop_markets_tenant_idx` ON `shop_markets` (`tenant_id`,`position`);--> statement-breakpoint
CREATE INDEX `shop_order_events_order_idx` ON `shop_order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shop_order_lines_order_idx` ON `shop_order_lines` (`order_id`,`position`);--> statement-breakpoint
CREATE INDEX `shop_orders_created_idx` ON `shop_orders` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shop_orders_customer_idx` ON `shop_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `shop_orders_payment_intent_idx` ON `shop_orders` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `shop_product_collection_items_product_idx` ON `shop_product_collection_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `shop_products_status_idx` ON `shop_products` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `shop_refunds_order_idx` ON `shop_refunds` (`order_id`);--> statement-breakpoint
CREATE INDEX `shop_refunds_provider_idx` ON `shop_refunds` (`provider_refund_id`);--> statement-breakpoint
CREATE INDEX `shop_shipping_rates_zone_idx` ON `shop_shipping_rates` (`zone_id`,`position`);--> statement-breakpoint
CREATE INDEX `shop_shipping_zones_tenant_idx` ON `shop_shipping_zones` (`tenant_id`,`position`);--> statement-breakpoint
CREATE INDEX `shop_shopify_imports_tenant_idx` ON `shop_shopify_imports` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shop_variants_product_idx` ON `shop_variants` (`product_id`,`position`);