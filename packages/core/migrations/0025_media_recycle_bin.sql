CREATE TABLE "binned_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"filename" text NOT NULL,
	"asset" jsonb NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binned_assets" ADD CONSTRAINT "binned_assets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "binned_assets_tenant_deleted_idx" ON "binned_assets" USING btree ("tenant_id","deleted_at");