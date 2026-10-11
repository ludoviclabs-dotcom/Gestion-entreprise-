import { pgTable, uuid, text, date, boolean, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";

export const hatvpOrganisations = pgTable("hatvp_organisations", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  siren: text("siren").notNull(),
  categoryCode: text("category_code"), categoryLabel: text("category_label"), categoryGroup: text("category_group"),
  firstPublishedOn: date("first_published_on"), lastActivityPublishedOn: date("last_activity_published_on"),
  activitiesPublished: boolean("activities_published"), lastExerciseEnd: date("last_exercise_end"),
  activityCountLast: integer("activity_count_last"), noActivityDeclared: boolean("no_activity_declared"),
  ceasedOn: date("ceased_on"), deregistrationReason: text("deregistration_reason"),
}, t => [primaryKey({ columns: [t.importId, t.siren] }), index("hatvp_organisations_siren_idx").on(t.siren, t.importId)]);
