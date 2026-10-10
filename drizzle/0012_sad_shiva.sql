ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'rge' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'agence_bio' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'alim_confiance' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'qualiopi' BEFORE 'manual';
