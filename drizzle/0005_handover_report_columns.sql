ALTER TABLE "tenders" ADD COLUMN "handover_plan_html" text;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "handover_presentation_html" text;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "handover_report_status" "analysis_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "handover_report_generated_at" timestamp;