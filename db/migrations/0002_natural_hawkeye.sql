CREATE TYPE "public"."plan_tier" AS ENUM('starter', 'advanced', 'pro');--> statement-breakpoint
CREATE TABLE "investment_plans" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"tier" "plan_tier" NOT NULL,
	"name" varchar(64) NOT NULL,
	"summary" text NOT NULL,
	"minimum_amount" numeric(20, 2),
	"maximum_amount" numeric(20, 2),
	"fee_percent" numeric(6, 3),
	"duration_days" integer,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_disclosure" text NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "investment_plans_amount_range" CHECK ("investment_plans"."minimum_amount" is null or "investment_plans"."maximum_amount" is null or "investment_plans"."maximum_amount" >= "investment_plans"."minimum_amount"),
	CONSTRAINT "investment_plans_fee_range" CHECK ("investment_plans"."fee_percent" is null or ("investment_plans"."fee_percent" >= 0 and "investment_plans"."fee_percent" <= 100))
);
--> statement-breakpoint
ALTER TABLE "investment_plans" ADD CONSTRAINT "investment_plans_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investment_plans_order_idx" ON "investment_plans" USING btree ("published","display_order");