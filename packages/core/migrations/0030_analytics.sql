CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"site_id" uuid NOT NULL,
	"day" text NOT NULL,
	"dimension" text NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"duration_count" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"site_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"visitor_hash" text,
	"path" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"device" text,
	"country" text DEFAULT '' NOT NULL,
	"duration_ms" integer,
	"name" text DEFAULT '' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_salts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"day" text NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_unique" ON "analytics_daily" USING btree ("tenant_id","site_id","day","dimension","key");--> statement-breakpoint
CREATE INDEX "analytics_events_site_day_idx" ON "analytics_events" USING btree ("tenant_id","site_id","day");--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_idx" ON "analytics_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_salts_tenant_day_unique" ON "analytics_salts" USING btree ("tenant_id","day");