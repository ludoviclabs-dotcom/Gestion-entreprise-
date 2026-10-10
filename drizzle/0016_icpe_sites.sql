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