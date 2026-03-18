CREATE TYPE "public"."company_document_type" AS ENUM('vision', 'year_plan', 'other');--> statement-breakpoint
CREATE TABLE "company_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" "company_document_type" NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text,
	"file_size" integer,
	"extracted_text" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"company_name" text,
	"kvk_number" text,
	"tenderned_number" text,
	"default_tender_manager_id" text,
	"website_url" text,
	"description" text,
	"vision_text" text,
	"annual_plan_text" text,
	"strengths_text" text,
	"references_text" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tender_documents" ADD COLUMN "tenderned_content_id" text;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "tenderned_publicatie_id" text;