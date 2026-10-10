-- Lot D0-D2 : SQL idempotent à copier dans Neon SQL Editor.
-- Aucun secret ni commande de migration locale.

-- 0014_open_data_imports.sql
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

-- 0015_camino_titres.sql
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'camino' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "camino_titres" (
	"import_id" uuid NOT NULL,
	"title_id" text NOT NULL,
	"siren" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"domain" text NOT NULL,
	"status" text NOT NULL,
	"substances" text NOT NULL,
	"departments" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"holder" boolean NOT NULL,
	"operator" boolean NOT NULL,
	CONSTRAINT "camino_titres_import_id_title_id_siren_pk" PRIMARY KEY("import_id","title_id","siren"),
	CONSTRAINT "camino_titres_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "camino_titres_siren_idx" ON "camino_titres" USING btree ("siren","import_id");

-- 0016_icpe_sites.sql
CREATE TABLE IF NOT EXISTS "icpe_sites" (
	"import_id" uuid NOT NULL,
	"code_aiot" text NOT NULL,
	"siret" text NOT NULL,
	"siren" text NOT NULL,
	"name" text,
	"commune" text,
	"naf" text,
	"regime" text,
	"seveso" text,
	"ied" boolean,
	"national_priority" boolean,
	"status" text,
	"inspections" integer NOT NULL,
	"last_inspection" date,
	CONSTRAINT "icpe_sites_import_id_code_aiot_pk" PRIMARY KEY("import_id","code_aiot"),
	CONSTRAINT "icpe_sites_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "icpe_sites_siren_idx" ON "icpe_sites" USING btree ("siren","import_id");
