CREATE TYPE "public"."rate_basis" AS ENUM('per_term', 'annual');--> statement-breakpoint
CREATE TYPE "public"."investment_status" AS ENUM('active', 'matured', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."ledger_account_type" ADD VALUE 'platform_treasury' BEFORE 'external';--> statement-breakpoint
ALTER TYPE "public"."ledger_tx_type" ADD VALUE 'investment_lock';--> statement-breakpoint
ALTER TYPE "public"."ledger_tx_type" ADD VALUE 'investment_release';--> statement-breakpoint
ALTER TYPE "public"."ledger_tx_type" ADD VALUE 'investment_return';--> statement-breakpoint
ALTER TYPE "public"."ledger_tx_type" ADD VALUE 'treasury_funding';--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" varchar(32) NOT NULL,
	"asset_id" varchar(32) NOT NULL,
	"principal" numeric(38, 18) NOT NULL,
	"plan_name" varchar(64) NOT NULL,
	"fixed_rate_percent" numeric(6, 3) NOT NULL,
	"rate_basis" varchar(16) NOT NULL,
	"duration_days" integer NOT NULL,
	"expected_return" numeric(38, 18) NOT NULL,
	"yield_source" text NOT NULL,
	"risk_disclosure" text NOT NULL,
	"usd_value_at_start" numeric(38, 2),
	"price_at_start" numeric(38, 12),
	"status" "investment_status" DEFAULT 'active' NOT NULL,
	"lock_transaction_id" uuid,
	"release_transaction_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matures_at" timestamp with time zone NOT NULL,
	"matured_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"idempotency_key" varchar(200) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "fixed_rate_percent" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "rate_basis" "rate_basis" DEFAULT 'per_term' NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "yield_source" text;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_plan_id_investment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."investment_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_lock_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("lock_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_release_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("release_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investments_user_idx" ON "investments" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "investments_maturity_idx" ON "investments" USING btree ("status","matures_at");--> statement-breakpoint
CREATE UNIQUE INDEX "investments_idempotency_idx" ON "investments" USING btree ("idempotency_key");--> statement-breakpoint
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_promise_explained" CHECK ("investment_plans"."fixed_rate_percent" is null or "investment_plans"."published" = false or ("investment_plans"."yield_source" is not null and "investment_plans"."duration_days" is not null));--> statement-breakpoint
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_rate_range" CHECK ("investment_plans"."fixed_rate_percent" is null or ("investment_plans"."fixed_rate_percent" >= 0 and "investment_plans"."fixed_rate_percent" <= 1000));