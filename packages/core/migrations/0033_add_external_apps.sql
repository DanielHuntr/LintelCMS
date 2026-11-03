CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_url" text,
	"scopes" jsonb NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"client_secret_start" text NOT NULL,
	"installed_by" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "app_id" uuid;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_installed_by_users_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apps_tenant_handle_unique" ON "apps" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_client_id_unique" ON "apps" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_client_secret_hash_unique" ON "apps" USING btree ("client_secret_hash");--> statement-breakpoint
CREATE INDEX "apps_tenant_created_idx" ON "apps" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhooks_app_idx" ON "webhooks" USING btree ("app_id");