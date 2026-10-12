ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'dgal' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dgal_approvals" (
	"import_id" uuid NOT NULL,
	"siren" text NOT NULL,
	"siret" text NOT NULL,
	"approval" text NOT NULL,
	"section" text NOT NULL,
	"categories" jsonb NOT NULL,
	"associated" jsonb NOT NULL,
	"exported_on" date,
	CONSTRAINT "dgal_approvals_import_id_siret_approval_section_pk" PRIMARY KEY("import_id","siret","approval","section"),
	CONSTRAINT "dgal_identifiers" CHECK ("dgal_approvals"."siren" ~ '^[0-9]{9}$' and "dgal_approvals"."siret" ~ '^[0-9]{14}$' and left("dgal_approvals"."siret", 9) = "dgal_approvals"."siren"),
	CONSTRAINT "dgal_arrays" CHECK (jsonb_typeof("dgal_approvals"."categories") = 'array' and jsonb_array_length("dgal_approvals"."categories") <= 24 and jsonb_typeof("dgal_approvals"."associated") = 'array' and jsonb_array_length("dgal_approvals"."associated") <= 400),
	CONSTRAINT "dgal_approvals_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dgal_approvals_siren_idx" ON "dgal_approvals" USING btree ("siren","import_id");
