CREATE TABLE "guild_settings" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"guild_id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"modules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prefix" text DEFAULT '/' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
