ALTER TYPE "public"."document_type" ADD VALUE 'terugkoppeling' BEFORE 'concept_aanbieding';--> statement-breakpoint
CREATE TABLE "lessons_learned" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"source_document_id" uuid,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"observation" text NOT NULL,
	"recommendation" text NOT NULL,
	"applicability_hint" text,
	"impact" text,
	"tags" text[],
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_source_document_id_tender_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."tender_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_learned_tender_idx" ON "lessons_learned" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "lessons_learned_created_idx" ON "lessons_learned" USING btree ("created_at");