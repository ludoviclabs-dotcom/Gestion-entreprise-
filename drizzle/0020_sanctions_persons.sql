ALTER TABLE "sanctions_entries" ADD COLUMN IF NOT EXISTS "birth_years" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sanctions_entries_keys_gin" ON "sanctions_entries" USING gin ("keys");
