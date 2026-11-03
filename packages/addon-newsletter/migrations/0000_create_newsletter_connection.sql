CREATE TABLE "newsletter_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"provider" text NOT NULL,
	"api_key" text NOT NULL,
	"list_id" text NOT NULL,
	"list_name" text DEFAULT '' NOT NULL,
	"double_opt_in" boolean DEFAULT true NOT NULL,
	"brevo_template_id" integer,
	"brevo_confirm_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_connection_tenant_idx" ON "newsletter_connection" USING btree ("tenant_id");