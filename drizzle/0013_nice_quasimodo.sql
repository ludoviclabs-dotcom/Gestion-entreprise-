ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'georisques' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'annuaire_administration' BEFORE 'manual';
