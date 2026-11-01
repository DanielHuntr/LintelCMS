CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"role" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"entry_id" uuid,
	"requested_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"comment" text,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"workflow_id" uuid NOT NULL,
	"workflow_name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"context" jsonb NOT NULL,
	"step_states" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"entry_id" uuid,
	"started_by" uuid,
	"next_run_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"error" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"step_type" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"attempt" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"secret" text NOT NULL,
	"purpose" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_step_logs" ADD CONSTRAINT "workflow_step_logs_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notifications_user_idx" ON "user_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_approvals_run_step_unique" ON "workflow_approvals" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE INDEX "workflow_approvals_entry_idx" ON "workflow_approvals" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_approvals_status_idx" ON "workflow_approvals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "workflow_runs_workflow_idx" ON "workflow_runs" USING btree ("workflow_id","created_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_due_idx" ON "workflow_runs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_entry_idx" ON "workflow_runs" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_idempotency_unique" ON "workflow_runs" USING btree ("workflow_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "workflow_step_logs_run_idx" ON "workflow_step_logs" USING btree ("run_id","position");--> statement-breakpoint
CREATE INDEX "workflows_tenant_idx" ON "workflows" USING btree ("tenant_id");