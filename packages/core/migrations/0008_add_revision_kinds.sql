ALTER TABLE "revisions" ADD COLUMN "kind" text DEFAULT 'edited' NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "is_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "restored_from_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing revisions keep what happened to them: saves become "edited", the rest keep their name.
UPDATE "revisions" SET "kind" = CASE "action" WHEN 'saved' THEN 'edited' ELSE "action" END, "updated_at" = "created_at";
