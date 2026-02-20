PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`moderator_id` text NOT NULL,
	`moderator_tag` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_warnings`("id", "guild_id", "user_id", "moderator_id", "moderator_tag", "reason", "created_at") SELECT "id", "guild_id", "user_id", "moderator_id", "moderator_tag", "reason", "created_at" FROM `warnings`;--> statement-breakpoint
DROP TABLE `warnings`;--> statement-breakpoint
ALTER TABLE `__new_warnings` RENAME TO `warnings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_audit_log_config` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`category` text NOT NULL,
	`channel_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_audit_log_config`("id", "guild_id", "category", "channel_id", "enabled", "created_at", "updated_at") SELECT "id", "guild_id", "category", "channel_id", "enabled", "created_at", "updated_at" FROM `audit_log_config`;--> statement-breakpoint
DROP TABLE `audit_log_config`;--> statement-breakpoint
ALTER TABLE `__new_audit_log_config` RENAME TO `audit_log_config`;--> statement-breakpoint
CREATE INDEX `audit_log_config_guild_category_idx` ON `audit_log_config` (`guild_id`,`category`);