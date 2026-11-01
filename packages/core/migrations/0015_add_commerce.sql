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
CREATE TABLE "shop_cart_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"token_hash" text NOT NULL,
	"market_id" uuid NOT NULL,
	"country" text,
	"email" text,
	"shipping_address" jsonb,
	"shipping_rate_id" uuid,
	"discount_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"cart_id" uuid,
	"market_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"email" text NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"currency" text NOT NULL,
	"lines" jsonb NOT NULL,
	"shipping_line" jsonb NOT NULL,
	"discounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"discount_amount" integer NOT NULL,
	"shipping_amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"taxes_included" boolean NOT NULL,
	"tax_calculation" text NOT NULL,
	"tax_reference" text,
	"payment_provider" text DEFAULT 'stripe' NOT NULL,
	"provider_payment_id" text,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"problem" text,
	"expires_at" timestamp with time zone NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "shop_fulfilments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"order_id" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"tracking_company" text DEFAULT '' NOT NULL,
	"tracking_number" text DEFAULT '' NOT NULL,
	"tracking_url" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_inventory_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"variant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_inventory_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"variant_id" uuid NOT NULL,
	"checkout_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"currency" text NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"exchange_rate" double precision DEFAULT 1 NOT NULL,
	"price_rounding" text DEFAULT 'exact' NOT NULL,
	"prices_include_tax" boolean DEFAULT true NOT NULL,
	"payment_provider" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_id" uuid,
	"product_title" text NOT NULL,
	"variant_title" text NOT NULL,
	"sku" text,
	"image_id" uuid,
	"quantity" integer NOT NULL,
	"unit_amount" integer NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"discount_amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"weight_grams" integer DEFAULT 0 NOT NULL,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	"refunded_quantity" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"checkout_id" uuid NOT NULL,
	"customer_id" uuid,
	"email" text NOT NULL,
	"market_id" uuid,
	"currency" text NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"shipping_line" jsonb NOT NULL,
	"discounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_amount" integer NOT NULL,
	"discount_amount" integer NOT NULL,
	"shipping_amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"taxes_included" boolean NOT NULL,
	"payment_status" text DEFAULT 'paid' NOT NULL,
	"fulfilment_status" text DEFAULT 'unfulfilled' NOT NULL,
	"payment_provider" text DEFAULT 'stripe' NOT NULL,
	"provider_payment_id" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
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
CREATE TABLE "shop_product_collection_items" (
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shop_product_collection_items_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "shop_product_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'manual' NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_all" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"description" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"product_type" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restock" boolean DEFAULT false NOT NULL,
	"notify_customer" boolean DEFAULT true NOT NULL,
	"stripe_refund_id" text,
	"provider_refund_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'flat' NOT NULL,
	"amounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight_brackets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"free_over_amounts" jsonb,
	"delivery_estimate" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"tenant_id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"shop_name" text DEFAULT '' NOT NULL,
	"support_email" text DEFAULT '' NOT NULL,
	"tax_calculation" text DEFAULT 'stripe' NOT NULL,
	"manual_tax_rates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tax_shipping" boolean DEFAULT true NOT NULL,
	"checkout_mode" text DEFAULT 'hosted' NOT NULL,
	"stripe_secret_key" text,
	"stripe_publishable_key" text,
	"stripe_webhook_secret" text,
	"order_number_prefix" text DEFAULT '#' NOT NULL,
	"next_order_number" integer DEFAULT 1001 NOT NULL,
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
CREATE TABLE "shop_stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_variant_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"variant_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount" integer NOT NULL,
	"compare_at_amount" integer
);
--> statement-breakpoint
CREATE TABLE "shop_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"option_values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sku" text,
	"barcode" text,
	"weight_grams" integer DEFAULT 0 NOT NULL,
	"inventory_tracked" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_archived_orders" ADD CONSTRAINT "shop_archived_orders_customer_id_shop_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."shop_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_cart_lines" ADD CONSTRAINT "shop_cart_lines_cart_id_shop_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."shop_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_cart_lines" ADD CONSTRAINT "shop_cart_lines_variant_id_shop_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_carts" ADD CONSTRAINT "shop_carts_market_id_shop_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."shop_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_discount_redemptions" ADD CONSTRAINT "shop_discount_redemptions_discount_id_shop_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."shop_discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_fulfilments" ADD CONSTRAINT "shop_fulfilments_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_fulfilments" ADD CONSTRAINT "shop_fulfilments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory_levels" ADD CONSTRAINT "shop_inventory_levels_variant_id_shop_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory_levels" ADD CONSTRAINT "shop_inventory_levels_location_id_shop_inventory_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."shop_inventory_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory_reservations" ADD CONSTRAINT "shop_inventory_reservations_variant_id_shop_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_inventory_reservations" ADD CONSTRAINT "shop_inventory_reservations_checkout_id_shop_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."shop_checkouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_events" ADD CONSTRAINT "shop_order_events_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_events" ADD CONSTRAINT "shop_order_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_lines" ADD CONSTRAINT "shop_order_lines_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_customer_id_shop_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."shop_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_product_collection_items" ADD CONSTRAINT "shop_product_collection_items_collection_id_shop_product_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."shop_product_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_product_collection_items" ADD CONSTRAINT "shop_product_collection_items_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_refunds" ADD CONSTRAINT "shop_refunds_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_refunds" ADD CONSTRAINT "shop_refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_shipping_rates" ADD CONSTRAINT "shop_shipping_rates_zone_id_shop_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shop_shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_shopify_imports" ADD CONSTRAINT "shop_shopify_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_variant_prices" ADD CONSTRAINT "shop_variant_prices_variant_id_shop_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_variants" ADD CONSTRAINT "shop_variants_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_archived_orders_name_idx" ON "shop_archived_orders" USING btree ("tenant_id","source","name");--> statement-breakpoint
CREATE INDEX "shop_archived_orders_customer_idx" ON "shop_archived_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "shop_archived_orders_placed_idx" ON "shop_archived_orders" USING btree ("tenant_id","placed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_cart_lines_variant_idx" ON "shop_cart_lines" USING btree ("cart_id","variant_id");--> statement-breakpoint
CREATE INDEX "shop_cart_lines_cart_idx" ON "shop_cart_lines" USING btree ("cart_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_carts_token_idx" ON "shop_carts" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shop_checkouts_status_idx" ON "shop_checkouts" USING btree ("tenant_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "shop_checkouts_session_idx" ON "shop_checkouts" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "shop_checkouts_provider_payment_idx" ON "shop_checkouts" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_customers_email_idx" ON "shop_customers" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_discount_redemptions_checkout_idx" ON "shop_discount_redemptions" USING btree ("discount_id","checkout_id");--> statement-breakpoint
CREATE INDEX "shop_discount_redemptions_discount_idx" ON "shop_discount_redemptions" USING btree ("discount_id","status");--> statement-breakpoint
CREATE INDEX "shop_discount_redemptions_email_idx" ON "shop_discount_redemptions" USING btree ("discount_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_discounts_code_idx" ON "shop_discounts" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "shop_discounts_method_idx" ON "shop_discounts" USING btree ("tenant_id","method","enabled");--> statement-breakpoint
CREATE INDEX "shop_fulfilments_order_idx" ON "shop_fulfilments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_inventory_levels_variant_idx" ON "shop_inventory_levels" USING btree ("variant_id","location_id");--> statement-breakpoint
CREATE INDEX "shop_inventory_locations_tenant_idx" ON "shop_inventory_locations" USING btree ("tenant_id","position");--> statement-breakpoint
CREATE INDEX "shop_inventory_reservations_variant_idx" ON "shop_inventory_reservations" USING btree ("variant_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "shop_inventory_reservations_checkout_idx" ON "shop_inventory_reservations" USING btree ("checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_markets_handle_idx" ON "shop_markets" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE INDEX "shop_markets_tenant_idx" ON "shop_markets" USING btree ("tenant_id","position");--> statement-breakpoint
CREATE INDEX "shop_order_events_order_idx" ON "shop_order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "shop_order_lines_order_idx" ON "shop_order_lines" USING btree ("order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_orders_number_idx" ON "shop_orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_orders_checkout_idx" ON "shop_orders" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "shop_orders_created_idx" ON "shop_orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "shop_orders_customer_idx" ON "shop_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "shop_orders_payment_intent_idx" ON "shop_orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "shop_product_collection_items_product_idx" ON "shop_product_collection_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_product_collections_handle_idx" ON "shop_product_collections" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_products_handle_idx" ON "shop_products" USING btree ("tenant_id","handle");--> statement-breakpoint
CREATE INDEX "shop_products_status_idx" ON "shop_products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "shop_refunds_order_idx" ON "shop_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_refunds_stripe_idx" ON "shop_refunds" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE INDEX "shop_refunds_provider_idx" ON "shop_refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "shop_shipping_rates_zone_idx" ON "shop_shipping_rates" USING btree ("zone_id","position");--> statement-breakpoint
CREATE INDEX "shop_shipping_zones_tenant_idx" ON "shop_shipping_zones" USING btree ("tenant_id","position");--> statement-breakpoint
CREATE INDEX "shop_shopify_imports_tenant_idx" ON "shop_shopify_imports" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_variant_prices_currency_idx" ON "shop_variant_prices" USING btree ("variant_id","currency");--> statement-breakpoint
CREATE INDEX "shop_variants_product_idx" ON "shop_variants" USING btree ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_variants_sku_idx" ON "shop_variants" USING btree ("tenant_id","sku");