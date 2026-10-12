ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'brreg' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'acra' BEFORE 'manual';
