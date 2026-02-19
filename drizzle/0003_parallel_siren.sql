CREATE TABLE `audit_log_config` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`category` text NOT NULL,
	`channel_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_config_guild_category_idx` ON `audit_log_config` (`guild_id`,`category`);