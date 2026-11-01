CREATE TABLE "shop_archived_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"source" text DEFAULT 'shopify' NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"customer_id" uuid,
	"currency" text NOT NULL,
	"subtotal_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"shipping_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT '' NOT NULL,
	"fulfilment_status" text DEFAULT '' NOT NULL,
	"discount_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shipping_address" jsonb,
	"placed_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_shopify_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"plan" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"stage" text DEFAULT 'products' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"report" jsonb NOT NULL,
	"dry_run_report" jsonb,
	"lease_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_archived_orders" ADD CONSTRAINT "shop_archived_orders_customer_id_shop_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."shop_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_shopify_imports" ADD CONSTRAINT "shop_shopify_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_archived_orders_name_idx" ON "shop_archived_orders" USING btree ("tenant_id","source","name");--> statement-breakpoint
CREATE INDEX "shop_archived_orders_customer_idx" ON "shop_archived_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "shop_archived_orders_placed_idx" ON "shop_archived_orders" USING btree ("tenant_id","placed_at");--> statement-breakpoint
CREATE INDEX "shop_shopify_imports_tenant_idx" ON "shop_shopify_imports" USING btree ("tenant_id","created_at");