ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'hatvp' BEFORE 'manual';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hatvp_organisations" (
	"import_id" uuid NOT NULL,
	"siren" text NOT NULL,
	"category_code" text,
	"category_label" text,
	"category_group" text,
	"first_published_on" date,
	"last_activity_published_on" date,
	"activities_published" boolean,
	"last_exercise_end" date,
	"activity_count_last" integer,
	"no_activity_declared" boolean,
	"ceased_on" date,
	"deregistration_reason" text,
	CONSTRAINT "hatvp_organisations_import_id_siren_pk" PRIMARY KEY("import_id","siren"),
	CONSTRAINT "hatvp_organisations_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hatvp_organisations_siren_idx" ON "hatvp_organisations" USING btree ("siren","import_id");
