ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'sanctions_intl' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sanctions_entries" (
	"import_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"entry_key" text NOT NULL,
	"sublist" text,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"programs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"listed_on" date,
	"kind" text NOT NULL,
	CONSTRAINT "sanctions_entries_import_id_entry_key_pk" PRIMARY KEY("import_id","entry_key"),
	CONSTRAINT "sanctions_entries_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
