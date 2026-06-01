CREATE TYPE "public"."case_status" AS ENUM('draft', 'enriching', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."edge_type" AS ENUM('DIRIGE', 'DETIENT', 'PARTAGE_ADRESSE', 'A_PUBLIE', 'EST_VISE_PAR', 'EMPLOIE');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('company', 'person', 'address', 'event', 'sanction');--> statement-breakpoint
CREATE TYPE "public"."evidence_level" AS ENUM('confirmed', 'declared', 'inferred', 'simulated');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('sirene', 'bodacc', 'inpi', 'tresor_gels', 'manual', 'fixture');--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_siren" text NOT NULL,
	"title" text NOT NULL,
	"status" "case_status" DEFAULT 'draft' NOT NULL,
	"score_complexite" integer,
	"score_vigilance" integer,
	"score_qualite_preuve" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"ligne" text,
	"code_postal" text,
	"commune" text,
	"pays" text DEFAULT 'France',
	"normalized" text
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"siren" text NOT NULL,
	"siret" text,
	"denomination" text,
	"forme_juridique" text,
	"naf_code" text,
	"naf_label" text,
	"date_creation" date,
	"tranche_effectif" text,
	"etat_administratif" text,
	"capital_social" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" "entity_type" NOT NULL,
	"label" text NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'declared' NOT NULL,
	"natural_key" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_case_naturalkey_uniq" UNIQUE("case_id","type","natural_key")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"entity_id" uuid PRIMARY KEY NOT NULL,
	"nom" text,
	"prenoms" text,
	"qualite" text,
	"date_naissance_partielle" text,
	"nationalite" text
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" "edge_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'declared' NOT NULL,
	"weight" text,
	"valid_from" date,
	"valid_to" date,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"entity_id" uuid,
	"kind" text NOT NULL,
	"source" "source_kind" NOT NULL,
	"occurred_on" date,
	"title" text NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'confirmed' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"source_record_id" uuid,
	"level" "evidence_level" NOT NULL,
	"excerpt" text,
	"pointer" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"source" "source_kind" NOT NULL,
	"endpoint" text NOT NULL,
	"http_status" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"is_fixture" text DEFAULT 'false' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"severity" "severity" NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'inferred' NOT NULL,
	"category" text NOT NULL,
	"explanation" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"graph" jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_id_entities_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_id_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_snapshots" ADD CONSTRAINT "graph_snapshots_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_case_idx" ON "entities" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "edges_case_idx" ON "edges" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "edges_source_idx" ON "edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "edges_target_idx" ON "edges" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "events_case_idx" ON "events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "evidence_subject_idx" ON "evidence" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "source_records_case_idx" ON "source_records" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "risk_signals_case_idx" ON "risk_signals" USING btree ("case_id");