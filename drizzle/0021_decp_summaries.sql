ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'decp' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decp_summaries" (
	"import_id" uuid NOT NULL,
	"siren" text NOT NULL,
	"role" text NOT NULL,
	"total" integer NOT NULL,
	"reliable_amount" numeric NOT NULL,
	"single_reliable" integer NOT NULL,
	"grouped" integer NOT NULL,
	"unreliable" integer NOT NULL,
	"last_notified" date NOT NULL,
	"buyers" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	CONSTRAINT "decp_summaries_import_id_siren_role_pk" PRIMARY KEY("import_id","siren","role"),
	CONSTRAINT "decp_summary_role" CHECK ("decp_summaries"."role" in ('holder', 'buyer')),
	CONSTRAINT "decp_summary_counts" CHECK ("decp_summaries"."total" > 0 and "decp_summaries"."single_reliable" >= 0 and "decp_summaries"."grouped" >= 0 and "decp_summaries"."unreliable" >= 0),
	CONSTRAINT "decp_summary_arrays" CHECK (jsonb_typeof("decp_summaries"."buyers") = 'array' and jsonb_array_length("decp_summaries"."buyers") <= 5 and jsonb_typeof("decp_summaries"."items") = 'array' and jsonb_array_length("decp_summaries"."items") <= 20),
	CONSTRAINT "decp_summaries_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decp_windows" (
	"import_id" uuid PRIMARY KEY NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"latest_file_month" text NOT NULL,
	CONSTRAINT "decp_window_order" CHECK ("decp_windows"."window_start" <= "decp_windows"."window_end"),
	CONSTRAINT "decp_windows_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decp_summaries_siren_idx" ON "decp_summaries" USING btree ("siren","import_id","role");