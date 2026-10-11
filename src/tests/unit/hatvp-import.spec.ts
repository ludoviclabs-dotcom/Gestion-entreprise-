import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { hatvpInput, projectHatvp, hatvpWriter } from "../../../scripts/import/hatvp";
import { hatvpAttributes } from "@/lib/ingestion/normalize-hatvp";

const base = { typeIdentifiantNational: "SIREN", identifiantNational: "552081317",
  categorieOrganisation: { code: "TRAIND", label: "Travailleur indépendant", categorie: "JURISTE" },
  dateCreation: "01/01/2020 12:30:45", datePremierePublication: "15/02/2020 12:30:45",
  dateDernierePublicationActivite: "01/03/2026 12:30:45", isActivitesPubliees: true,
  exercices: [{ publicationCourante: { dateFin: "31-12-2025", nombreActivite: 0, noActivite: true } }],
};
async function read(text: string, minimum = 1, maxBytes?: number) {
  const input = hatvpInput(Readable.from([Buffer.from(text)]), minimum, maxBytes);
  const rows = [];
  for await (const r of input.rows) rows.push(r);
  return { rows, stats: input.stats, sha: input.fingerprint() };
}
const json = (publications: unknown[]) => JSON.stringify({ publications });

describe("import HATVP — organisations seulement", () => {
  it("ne conserve aucun champ privé, même pour un indépendant ou une catégorie piégée", async () => {
    // Marqueurs synthétiques uniquement : aucun nom réel ni coordonnée de personne en test.
    const marker = "IDENTITE_INTERDITE";
    const r = { ...base, denomination: marker, nomUsage: marker, sigleHatvp: marker, nomUsageHatvp: marker, ancienNomHatvp: marker,
      dirigeants: [{ nom: marker, prenom: marker }], collaborateurs: [{ nom: marker }], clients: [marker], affiliations: [marker],
      telephoneDeContact: marker, emailDeContact: marker, adresse: marker, lienSiteWeb: marker,
      motivationDesinscription: marker, categorieOrganisation: { ...base.categorieOrganisation, label: marker, categorie: marker } };
    const { rows, sha } = await read(json([r]));
    expect(rows).toEqual([projectHatvp(r)]);
    expect(rows[0]).toMatchObject({ siren: "552081317", category_code: "TRAIND", category_label: "Travailleur indépendant",
      category_group: "JURISTE", first_published_on: "2020-02-15", last_exercise_end: "2025-12-31", activity_count_last: 0 });
    expect(Object.keys(rows[0]).sort()).toEqual(["siren", "category_code", "category_label", "category_group", "first_published_on",
      "last_activity_published_on", "activities_published", "last_exercise_end", "activity_count_last", "no_activity_declared", "ceased_on", "deregistration_reason"].sort());
    const p = rows[0];
    const attrs = hatvpAttributes({ status: "ok", importedAt: "2026-10-11T12:00:00Z", organisation: {
      siren: p.siren, categoryCode: p.category_code, categoryLabel: p.category_label, categoryGroup: p.category_group,
      firstPublishedOn: p.first_published_on, lastActivityPublishedOn: p.last_activity_published_on, activitiesPublished: p.activities_published,
      lastExerciseEnd: p.last_exercise_end, activityCountLast: p.activity_count_last, noActivityDeclared: p.no_activity_declared,
      ceasedOn: p.ceased_on, deregistrationReason: p.deregistration_reason } });
    expect(JSON.stringify({ rows, attrs })).not.toContain(marker);
    expect(sha).toBe(createHash("sha256").update(json([r])).digest("hex"));
  });
  it("valide seulement les SIREN stricts et conserve La Poste et les indépendants", () => {
    for (const id of ["000000000", "552081318", "55208131700000", " 552081317", "552081317' OR true"]) {
      expect(projectHatvp({ ...base, identifiantNational: id })).toBeNull();
    }
    for (const type of ["RNA", "HATVP"]) expect(projectHatvp({ ...base, typeIdentifiantNational: type })).toBeNull();
    expect(projectHatvp({ ...base, identifiantNational: "356000000" })?.siren).toBe("356000000");
    expect(projectHatvp(base)?.category_code).toBe("TRAIND");
  });
  it("dédoublonne sur la publication la plus récente, heure comprise, à défaut la création", async () => {
    const newer = { ...base, dateDernierePublicationActivite: "01/03/2026 15:00:00", isActivitesPubliees: false };
    const older = { ...base, dateDernierePublicationActivite: "01/03/2026 13:00:00" };
    for (const input of [[newer, older], [older, newer]]) {
      const r = await read(json(input));
      expect(r.rows).toHaveLength(1); expect(r.rows[0].activities_published).toBe(false);
      expect(r.stats).toMatchObject({ organisations: 2, sirenRecords: 2, duplicates: 1 });
    }
    const r = await read(json([{ ...newer, dateDernierePublicationActivite: null, dateCreation: "02/01/2020 12:00:00" },
      { ...older, dateDernierePublicationActivite: null, dateCreation: "01/01/2020 12:00:00" }]));
    expect(r.rows[0].activities_published).toBe(false);
  });
  it("sélectionne le dernier exercice et distingue inconnus, faux et zéro", () => {
    const p = projectHatvp({ ...base, isActivitesPubliees: null, dateCessation: "12/03/2025", motifDesinscription: "CESSATION",
      exercices: [...base.exercices, { publicationCourante: { dateFin: "31-12-2026", nombreActivite: null, noActivite: null } }] })!;
    expect(p).toMatchObject({ last_exercise_end: "2026-12-31", activity_count_last: null, no_activity_declared: null,
      activities_published: null, ceased_on: "2025-03-12", deregistration_reason: "CESSATION" });
    expect(projectHatvp({ ...base, motifDesinscription: "TEXTE_INTERDIT" })?.deregistration_reason).toBeNull();
    expect(projectHatvp({ ...base, motifDesinscription: "ABANDON" })?.deregistration_reason).toBe("ABANDON");
    expect(projectHatvp({ ...base, categorieOrganisation: { code: "INCONNU" } })).toMatchObject({ category_code: null, category_label: null, category_group: null });
    expect(projectHatvp({ ...base, isActivitesPubliees: "false" })?.activities_published).toBeNull();
  });
  it("refuse les dates impossibles et les schémas non reconnus", async () => {
    for (const field of ["dateCreation", "datePremierePublication", "dateDernierePublicationActivite", "dateCessation"]) {
      await expect(read(json([{ ...base, [field]: "31/02/2026 25:00:00" }]))).rejects.toThrow();
    }
    expect(() => projectHatvp({ ...base, exercices: [{ publicationCourante: { dateFin: "31-02-2026" } }] })).toThrow();
    for (const s of ["{}", '{"publications":{}}', '{"publications":[]}', '{"publications":[null]}', json([{}]), "<html>erreur</html>",
      json([base]).slice(0, -1), '{"publications":[],' + json([base]).slice(1)]) await expect(read(s)).rejects.toThrow();
    await expect(read(json([base]), 1000)).rejects.toThrow();
    await expect(read(json([{ ...base, typeIdentifiantNational: "RNA" }]))).rejects.toThrow();
  });
  it("borne les octets, clés, scalaires et projections ; ignore de longues données exclues", async () => {
    await expect(read(json([base]), 1, 20)).rejects.toThrow();
    await expect(read(json([{ ...base, identifiantNational: "x".repeat(300) }]))).rejects.toThrow();
    await expect(read(json([{ ...base, ["x".repeat(300)]: "x" }]))).rejects.toThrow();
    const r = await read(json([{ ...base, denomination: "CHAMP_INTERDIT".repeat(100000) }]));
    expect(r.rows).toHaveLength(1); expect(JSON.stringify(r.rows)).not.toContain("CHAMP_INTERDIT");
    await expect(read(json([{ ...base, exercices: Array.from({ length: 7000 }, () => base.exercices[0]) }]))).rejects.toThrow();
  });
  it("ne publie aucune empreinte après coupure ou arrêt anticipé", async () => {
    const source = Readable.from((async function* () { yield Buffer.from(json([base])); throw new Error("COUPURE"); })());
    const input = hatvpInput(source, 1);
    await expect(async () => { for await (const r of input.rows) void r; }).rejects.toThrow();
    expect(() => input.fingerprint()).toThrow(); expect(source.destroyed).toBe(true);
    const early = hatvpInput(Readable.from([Buffer.from(json([base, { ...base, identifiantNational: "356000000" }]))]), 1);
    for await (const r of early.rows) { expect(r.siren).toBe("552081317"); break; }
    expect(() => early.fingerprint()).toThrow();
  });
  it("utilise un upsert par SIREN, compte et purge par import", async () => {
    let values: unknown, query = "";
    const tx = (first: unknown) => {
      if (Array.isArray(first) && "raw" in first) { query = first.join("?"); return Promise.resolve([{ count: 1 }]); }
      values = first; return "values";
    };
    const r = projectHatvp(base)!;
    await hatvpWriter.write(tx as never, "import-id", [r, r]);
    expect(values).toEqual([{ ...r, import_id: "import-id" }]);
    expect(query).toContain("on conflict (import_id, siren) do update");
    expect(await hatvpWriter.count(tx as never, "import-id")).toBe(1);
    expect(query).toContain("where import_id =");
    await hatvpWriter.prune(tx as never, "import-id"); expect(query).toContain("where import_id <>");
  });
});
