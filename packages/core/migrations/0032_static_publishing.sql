CREATE TABLE "bridge_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"target_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"target_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"summary" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "publish_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"site_id" uuid,
	"kind" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sealed_secrets" text,
	"form_delivery" text DEFAULT 'bridge' NOT NULL,
	"publish_automatically" boolean DEFAULT false NOT NULL,
	"delete_limit" integer DEFAULT 50 NOT NULL,
	"last_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bridge_receipts" ADD CONSTRAINT "bridge_receipts_target_id_publish_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."publish_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_runs" ADD CONSTRAINT "publish_runs_target_id_publish_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."publish_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_targets" ADD CONSTRAINT "publish_targets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bridge_receipts_item_unique" ON "bridge_receipts" USING btree ("target_id","item_id");--> statement-breakpoint
CREATE INDEX "publish_runs_target_idx" ON "publish_runs" USING btree ("tenant_id","target_id","started_at");--> statement-breakpoint
CREATE INDEX "publish_targets_tenant_idx" ON "publish_targets" USING btree ("tenant_id");