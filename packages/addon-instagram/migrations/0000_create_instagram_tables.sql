CREATE TABLE "instagram_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"access_token" text NOT NULL,
	"instagram_user_id" text NOT NULL,
	"username" text NOT NULL,
	"token_refreshed_at" timestamp with time zone NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"instagram_id" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"permalink" text NOT NULL,
	"media_type" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"image" "bytea" NOT NULL,
	"image_type" text NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_account_tenant_idx" ON "instagram_account" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_posts_tenant_instagram_id_idx" ON "instagram_posts" USING btree ("tenant_id","instagram_id");--> statement-breakpoint
CREATE INDEX "instagram_posts_tenant_posted_at_idx" ON "instagram_posts" USING btree ("tenant_id","posted_at");