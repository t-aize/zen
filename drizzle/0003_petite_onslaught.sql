CREATE TABLE "automod_exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"rule_type" varchar(100),
	"target_type" varchar(32) NOT NULL,
	"target_id" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automod_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"rule_type" varchar(100) NOT NULL,
	"target_id" varchar(32) NOT NULL,
	"channel_id" varchar(32),
	"action_taken" varchar(64) NOT NULL,
	"case_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automod_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"rule_type" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"action_duration_seconds" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" integer NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"target_id" varchar(32) NOT NULL,
	"moderator_id" varchar(32),
	"reason" text NOT NULL,
	"duration_seconds" integer,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raid_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"triggered_at" timestamp with time zone,
	"trigger_reason" varchar(255),
	"resolved_at" timestamp with time zone,
	"resolved_by_id" varchar(32),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warn_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(32) NOT NULL,
	"warn_count" integer NOT NULL,
	"action_type" varchar(64) NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automod_incidents" ADD CONSTRAINT "automod_incidents_case_id_mod_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."mod_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automod_exemptions_guild_id_idx" ON "automod_exemptions" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "automod_exemptions_target_idx" ON "automod_exemptions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automod_exemptions_scope_uidx" ON "automod_exemptions" USING btree ("guild_id","rule_type","target_type","target_id");--> statement-breakpoint
CREATE INDEX "automod_incidents_guild_created_at_idx" ON "automod_incidents" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "automod_incidents_rule_type_idx" ON "automod_incidents" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "automod_incidents_target_id_idx" ON "automod_incidents" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "automod_incidents_case_id_idx" ON "automod_incidents" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automod_rules_guild_rule_type_uidx" ON "automod_rules" USING btree ("guild_id","rule_type");--> statement-breakpoint
CREATE INDEX "automod_rules_guild_enabled_idx" ON "automod_rules" USING btree ("guild_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "mod_cases_guild_case_number_uidx" ON "mod_cases" USING btree ("guild_id","case_number");--> statement-breakpoint
CREATE INDEX "mod_cases_guild_created_at_idx" ON "mod_cases" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "mod_cases_target_id_idx" ON "mod_cases" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "mod_cases_moderator_id_idx" ON "mod_cases" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "mod_cases_active_expires_at_idx" ON "mod_cases" USING btree ("active","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_states_guild_id_uidx" ON "raid_states" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "raid_states_active_idx" ON "raid_states" USING btree ("active");--> statement-breakpoint
CREATE INDEX "warn_thresholds_guild_id_idx" ON "warn_thresholds" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warn_thresholds_guild_warn_count_uidx" ON "warn_thresholds" USING btree ("guild_id","warn_count");