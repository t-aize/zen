PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`moderator_id` text NOT NULL,
	`moderator_tag` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_warnings`("id", "guild_id", "user_id", "moderator_id", "moderator_tag", "reason", "created_at") SELECT "id", "guild_id", "user_id", "moderator_id", "moderator_tag", "reason", "created_at" FROM `warnings`;--> statement-breakpoint
DROP TABLE `warnings`;--> statement-breakpoint
ALTER TABLE `__new_warnings` RENAME TO `warnings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;