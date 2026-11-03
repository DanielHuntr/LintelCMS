ALTER TABLE "shop_orders" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "stripe_events_checked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "stripe_last_webhook_at" timestamp with time zone;