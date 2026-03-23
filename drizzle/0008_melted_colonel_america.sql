CREATE TYPE "public"."tender_intake_suitability_tier" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "tender_description" text;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "intake_suitability_tier" "tender_intake_suitability_tier";--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "intake_suitability_score" integer;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "intake_suitability_summary" text;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "intake_suitability_status" "analysis_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "intake_suitability_generated_at" timestamp;
