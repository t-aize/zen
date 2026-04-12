CREATE TYPE "public"."ticket_action" AS ENUM('opened', 'claimed', 'unclaimed', 'renamed', 'closed', 'reopened', 'deleted', 'transcript_generated', 'participant_added', 'participant_removed');--> statement-breakpoint
CREATE TYPE "public"."ticket_button_style" AS ENUM('primary', 'secondary', 'success', 'danger');--> statement-breakpoint
CREATE TYPE "public"."ticket_channel_type" AS ENUM('text', 'private_thread', 'forum_post');--> statement-breakpoint
CREATE TYPE "public"."ticket_open_method" AS ENUM('panel', 'command', 'api', 'automation', 'migration');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'closed', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "panel_categories" (
	"panel_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"button_style" "ticket_button_style" DEFAULT 'primary' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "panel_categories_panel_id_category_id_pk" PRIMARY KEY("panel_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" varchar(32) NOT NULL,
	"action" "ticket_action" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"emoji" varchar(64),
	"staff_role_id" varchar(32),
	"channel_type" "ticket_channel_type" DEFAULT 'text' NOT NULL,
	"parent_channel_id" varchar(32),
	"naming_template" varchar(255) DEFAULT 'ticket-{ticketNumber}' NOT NULL,
	"max_open_per_user" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"log_channel_id" varchar(32),
	"transcript_channel_id" varchar(32),
	"max_open_per_user" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"discord_message_id" varchar(32) NOT NULL,
	"author_id" varchar(32) NOT NULL,
	"author_username" varchar(255) NOT NULL,
	"content" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"channel_id" varchar(32) NOT NULL,
	"message_id" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_participants" (
	"ticket_id" uuid NOT NULL,
	"user_id" varchar(32) NOT NULL,
	"added_by_id" varchar(32) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_participants_ticket_id_user_id_pk" PRIMARY KEY("ticket_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" integer NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"category_id" uuid NOT NULL,
	"opener_id" varchar(32) NOT NULL,
	"claimed_by_id" varchar(32),
	"channel_id" varchar(32) NOT NULL,
	"channel_type" "ticket_channel_type" NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"open_method" "ticket_open_method" DEFAULT 'panel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_settings" ALTER COLUMN "guild_id" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "panel_categories" ADD CONSTRAINT "panel_categories_panel_id_ticket_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."ticket_panels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_categories" ADD CONSTRAINT "panel_categories_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_actions" ADD CONSTRAINT "ticket_actions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_participants" ADD CONSTRAINT "ticket_participants_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_ticket_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "panel_categories_panel_position_uidx" ON "panel_categories" USING btree ("panel_id","position");--> statement-breakpoint
CREATE INDEX "panel_categories_category_id_idx" ON "panel_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ticket_actions_ticket_id_idx" ON "ticket_actions" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_actions_created_at_idx" ON "ticket_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ticket_categories_guild_id_idx" ON "ticket_categories" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_categories_guild_name_uidx" ON "ticket_categories" USING btree ("guild_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_configs_guild_id_uidx" ON "ticket_configs" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_messages_discord_message_id_uidx" ON "ticket_messages" USING btree ("discord_message_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_sent_at_idx" ON "ticket_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "ticket_panels_guild_id_idx" ON "ticket_panels" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "ticket_panels_channel_id_idx" ON "ticket_panels" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_panels_message_id_uidx" ON "ticket_panels" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "ticket_participants_user_id_idx" ON "ticket_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_channel_id_uidx" ON "tickets" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_guild_ticket_number_uidx" ON "tickets" USING btree ("guild_id","ticket_number");--> statement-breakpoint
CREATE INDEX "tickets_category_id_idx" ON "tickets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tickets_guild_status_idx" ON "tickets" USING btree ("guild_id","status");--> statement-breakpoint
CREATE INDEX "tickets_opener_id_idx" ON "tickets" USING btree ("opener_id");--> statement-breakpoint
CREATE INDEX "guild_settings_locale_idx" ON "guild_settings" USING btree ("locale");