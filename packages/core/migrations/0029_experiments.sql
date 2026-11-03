CREATE TABLE "experiment_counts" (
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"experiment_id" uuid NOT NULL,
	"version_key" text NOT NULL,
	"day" date NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "experiment_counts_experiment_id_version_key_day_pk" PRIMARY KEY("experiment_id","version_key","day")
);
--> statement-breakpoint
CREATE TABLE "experiment_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"experiment_id" uuid NOT NULL,
	"key" text NOT NULL,
	"design" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entry_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"section_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"goal" jsonb,
	"split" jsonb NOT NULL,
	"secret" text NOT NULL,
	"winner" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_counts" ADD CONSTRAINT "experiment_counts_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_versions" ADD CONSTRAINT "experiment_versions_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_versions_key_idx" ON "experiment_versions" USING btree ("experiment_id","key");--> statement-breakpoint
CREATE INDEX "experiments_tenant_entry_idx" ON "experiments" USING btree ("tenant_id","entry_id");--> statement-breakpoint
CREATE INDEX "experiments_tenant_status_idx" ON "experiments" USING btree ("tenant_id","status");