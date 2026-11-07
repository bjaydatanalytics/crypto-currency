CREATE TYPE "public"."plan_category" AS ENUM('standard', 'retirement');--> statement-breakpoint
ALTER TABLE "investment_plans" ADD COLUMN "category" "plan_category" DEFAULT 'standard' NOT NULL;