CREATE TABLE IF NOT EXISTS "open_data_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"version" text NOT NULL,
	"source_url" text NOT NULL,
	"sha256" text,
	"record_count" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	CONSTRAINT "open_data_imports_status_check" CHECK ("open_data_imports"."status" in ('running', 'ok', 'failed')),
	CONSTRAINT "open_data_imports_count_check" CHECK ("open_data_imports"."record_count" >= 0),
	CONSTRAINT "open_data_imports_complete_check" CHECK ("open_data_imports"."status" <> 'ok' or ("open_data_imports"."sha256" is not null and "open_data_imports"."sha256" ~ '^[a-f0-9]{64}$' and "open_data_imports"."imported_at" is not null and "open_data_imports"."checked_at" is not null))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "open_data_imports_latest_idx" ON "open_data_imports" USING btree ("source","status","imported_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "open_data_imports_attempt_idx" ON "open_data_imports" USING btree ("source","started_at");