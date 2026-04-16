-- Add enrichment columns to lounges table
ALTER TABLE "lounges" ADD COLUMN "source_url" VARCHAR;
ALTER TABLE "lounges" ADD COLUMN "image_url" VARCHAR;
ALTER TABLE "lounges" ADD COLUMN "venue_type" VARCHAR NOT NULL DEFAULT 'lounge';
ALTER TABLE "lounges" ADD COLUMN "is_airside" BOOLEAN;
ALTER TABLE "lounges" ADD COLUMN "gate_proximity" TEXT;
ALTER TABLE "lounges" ADD COLUMN "detail_amenities" JSONB;
ALTER TABLE "lounges" ADD COLUMN "access_conditions" JSONB;
ALTER TABLE "lounges" ADD COLUMN "detail_last_fetched_at" TIMESTAMPTZ;
