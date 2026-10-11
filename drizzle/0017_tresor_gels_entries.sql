CREATE TABLE IF NOT EXISTS "tresor_gels_entries" (
	"import_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"nom" text NOT NULL,
	"nature" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publication_date" text,
	"register_total" integer NOT NULL,
	CONSTRAINT "tresor_gels_entries_import_id_position_pk" PRIMARY KEY("import_id","position"),
	CONSTRAINT "tresor_gels_entries_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
