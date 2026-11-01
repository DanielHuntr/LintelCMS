CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"filename" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"size" bigint,
	"checksum" text,
	"contents" jsonb,
	"failure_reason" text,
	"created_by_name" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "backups_tenant_filename_unique" ON "backups" USING btree ("tenant_id","filename");--> statement-breakpoint
CREATE INDEX "backups_tenant_created_idx" ON "backups" USING btree ("tenant_id","created_at");