CREATE TABLE `warnings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`moderator_id` text NOT NULL,
	`moderator_tag` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
