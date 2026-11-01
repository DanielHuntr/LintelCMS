CREATE TABLE "shop_discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"discount_id" uuid NOT NULL,
	"checkout_id" uuid NOT NULL,
	"order_id" uuid,
	"email" text NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"method" text NOT NULL,
	"code" text,
	"kind" text NOT NULL,
	"percent_off" integer DEFAULT 0 NOT NULL,
	"amounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"buy_quantity" integer DEFAULT 0 NOT NULL,
	"get_quantity" integer DEFAULT 0 NOT NULL,
	"scope" text DEFAULT 'order' NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collection_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minimum_spend" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"minimum_quantity" integer,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"per_customer_limit" integer,
	"combines_with_others" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_payment_accounts" (
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"provider" text NOT NULL,
	"credentials" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_payment_accounts_tenant_id_provider_pk" PRIMARY KEY("tenant_id","provider")
);
--> statement-breakpoint
CREATE TABLE "shop_payment_events" (
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_payment_events_provider_event_id_pk" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "shop_checkouts" ADD COLUMN "payment_provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_checkouts" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "shop_markets" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "payment_provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "shop_refunds" ADD COLUMN "provider_refund_id" text;--> statement-breakpoint
ALTER TABLE "shop_discount_redemptions" ADD CONSTRAINT "shop_discount_redemptions_discount_id_shop_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."shop_discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_discount_redemptions_checkout_idx" ON "shop_discount_redemptions" USING btree ("discount_id","checkout_id");--> statement-breakpoint
CREATE INDEX "shop_discount_redemptions_discount_idx" ON "shop_discount_redemptions" USING btree ("discount_id","status");--> statement-breakpoint
CREATE INDEX "shop_discount_redemptions_email_idx" ON "shop_discount_redemptions" USING btree ("discount_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_discounts_code_idx" ON "shop_discounts" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "shop_discounts_method_idx" ON "shop_discounts" USING btree ("tenant_id","method","enabled");--> statement-breakpoint
CREATE INDEX "shop_checkouts_provider_payment_idx" ON "shop_checkouts" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "shop_refunds_provider_idx" ON "shop_refunds" USING btree ("provider_refund_id");