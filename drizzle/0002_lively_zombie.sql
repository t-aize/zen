CREATE TABLE "log_channel_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"log_group" varchar(100) NOT NULL,
	"discord_channel_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"discord_category_id" varchar(32),
	"retention_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"log_group" varchar(100) NOT NULL,
	"actor_id" varchar(32),
	"target_id" varchar(32),
	"target_type" varchar(100),
	"channel_id" varchar(32),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"discord_message_id" varchar(32),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_event_settings" (
	"guild_id" varchar(32) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "log_event_settings_guild_id_event_type_pk" PRIMARY KEY("guild_id","event_type")
);
--> statement-breakpoint
CREATE INDEX "log_channel_bindings_guild_group_idx" ON "log_channel_bindings" USING btree ("guild_id","log_group");--> statement-breakpoint
CREATE UNIQUE INDEX "log_channel_bindings_guild_group_channel_uidx" ON "log_channel_bindings" USING btree ("guild_id","log_group","discord_channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "log_configs_guild_id_uidx" ON "log_configs" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "log_entries_guild_created_at_idx" ON "log_entries" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "log_entries_guild_group_created_at_idx" ON "log_entries" USING btree ("guild_id","log_group","created_at");--> statement-breakpoint
CREATE INDEX "log_entries_guild_event_type_idx" ON "log_entries" USING btree ("guild_id","event_type");--> statement-breakpoint
CREATE INDEX "log_entries_expires_at_idx" ON "log_entries" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "log_entries_discord_message_id_uidx" ON "log_entries" USING btree ("discord_message_id");--> statement-breakpoint
CREATE INDEX "log_event_settings_guild_enabled_idx" ON "log_event_settings" USING btree ("guild_id","enabled");