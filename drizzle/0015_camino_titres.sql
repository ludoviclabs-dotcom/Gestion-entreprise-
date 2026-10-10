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