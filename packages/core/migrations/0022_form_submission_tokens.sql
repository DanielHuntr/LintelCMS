ALTER TABLE "form_submissions" ADD COLUMN "token_hash" text;--> statement-breakpoint
CREATE INDEX "form_submissions_token_idx" ON "form_submissions" USING btree ("form_id","token_hash");