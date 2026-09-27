CREATE TYPE "public"."wallet_chain" AS ENUM('ethereum', 'polygon', 'arbitrum', 'base', 'optimism');--> statement-breakpoint
CREATE TYPE "public"."wallet_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "platform_deposit_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar(32) NOT NULL,
	"network" varchar(64) NOT NULL,
	"address" varchar(128) NOT NULL,
	"address_tag" varchar(64),
	"label" varchar(96) NOT NULL,
	"custodian" varchar(32) NOT NULL,
	"notes" text,
	"status" "address_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" uuid,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "linked_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chain" "wallet_chain" NOT NULL,
	"address" varchar(64) NOT NULL,
	"label" varchar(64),
	"status" "wallet_status" DEFAULT 'active' NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"address" varchar(64) NOT NULL,
	"chain" "wallet_chain" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "deposit_addresses_address_idx";--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "source_address_id" uuid;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "status" "address_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_deposit_addresses" ADD CONSTRAINT "platform_deposit_addresses_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_deposit_addresses" ADD CONSTRAINT "platform_deposit_addresses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_deposit_addresses" ADD CONSTRAINT "platform_deposit_addresses_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_wallets" ADD CONSTRAINT "linked_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_nonces" ADD CONSTRAINT "wallet_nonces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_deposit_addresses_lookup_idx" ON "platform_deposit_addresses" USING btree ("asset_id","network","status");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_deposit_addresses_destination_idx" ON "platform_deposit_addresses" USING btree ("address","network",coalesce("address_tag", ''));--> statement-breakpoint
CREATE INDEX "linked_wallets_user_idx" ON "linked_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_wallets_unique_idx" ON "linked_wallets" USING btree ("user_id","chain","address");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_nonces_value_idx" ON "wallet_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "wallet_nonces_user_idx" ON "wallet_nonces" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD CONSTRAINT "deposit_addresses_source_address_id_platform_deposit_addresses_id_fk" FOREIGN KEY ("source_address_id") REFERENCES "public"."platform_deposit_addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD CONSTRAINT "deposit_addresses_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deposit_addresses_source_idx" ON "deposit_addresses" USING btree ("source_address_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_addresses_active_idx" ON "deposit_addresses" USING btree ("user_id","asset_id","network") WHERE "deposit_addresses"."status" = 'active';