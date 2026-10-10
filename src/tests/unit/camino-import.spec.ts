import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { caminoInput, projectCamino, caminoWriter } from "../../../scripts/import/camino";

const base = { id: "m-test", nom: "Mine exemple", type: "Concession", domaine: "métaux",
  statut: "valide", substances: "or", departements: "973", date_debut: "01-02-2000",
  date_fin: "28-02-2030", titulaires_legal: "552081317", amodiataires_legal: "" };
function csv(rows: Record<string, string>[], headers = Object.keys(base)) {
  const cell = (s: string) => `"${s.replaceAll('"', '""')}"`;
  return headers.join(",") + "\n" + rows.map(r => headers.map(h => cell(r[h] ?? "")).join(",")).join("\n") + "\n";
}
async function read(text: string, minimum = 1) {
  const input = caminoInput(Readable.from([Buffer.from(text)]), minimum);
  const rows = [];
  for await (const r of input.rows) rows.push(r);
  return { rows, sha: input.fingerprint() };
}
describe("import Camino", () => {
  it("analyse les guillemets, virgules et lignes internes sans conserver les champs privés", async () => {
    const r = { ...base, nom: 'Mine "Or", secteur\nNord', titulaires_noms: "PERSONNE PRIVEE",
      titulaires_adresses: "ADRESSE PRIVEE", geojson: "GEOMETRIE" };
    const { rows, sha } = await read(csv([r], Object.keys(r)));
    expect(rows[0].name).toBe(r.nom);
    expect(rows[0].starts_on).toBe("2000-02-01");
    expect(JSON.stringify(rows)).not.toMatch(/PERSONNE PRIVEE|ADRESSE PRIVEE|GEOMETRIE/);
    expect(sha).toMatch(/^[a-f0-9]{64}$/);
  });
  it("conserve les entrepreneurs individuels, réunit les rôles et filtre les identifiants strictement", () => {
    const rows = projectCamino({ ...base, titulaires_categorie: "1000", titulaires_legal:
      "552081317; 552081317; 343262622; 000000000; 552081318; fr552081317; 552081317' OR 1=1",
      amodiataires_legal: "552081317;356000000" });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ siren: "552081317", holder: true, operator: true });
    expect(rows[2]).toMatchObject({ siren: "356000000", holder: false, operator: true });
  });
  it("refuse un schéma changé ou ambigu", async () => {
    await expect(read(csv([base], Object.keys(base).filter(k => k !== "id")))).rejects.toThrow();
    await expect(read(csv([base], [...Object.keys(base), "id"]))).rejects.toThrow();
    await expect(read("<html>indisponible</html>")).rejects.toThrow();
  });
  it("refuse les CSV tronqués et les fichiers nationaux anormalement courts", async () => {
    await expect(read(csv([base]) + '"citation inachevée')).rejects.toThrow();
    await expect(read(csv([base]), 1000)).rejects.toThrow();
    await expect(read(csv([]))).rejects.toThrow();
    await expect(read(csv([base]) + "trop,peu,de,champs\n")).rejects.toThrow();
  });
  it("refuse les dates impossibles et accepte une date absente", () => {
    expect(() => projectCamino({ ...base, date_fin: "31-02-2030" })).toThrow();
    expect(() => projectCamino({ ...base, date_debut: "2000-02-01" })).toThrow();
    expect(projectCamino({ ...base, date_fin: "" })[0].ends_on).toBeNull();
  });
  it("borne une ligne démesurée et ne publie pas une empreinte partielle", async () => {
    await expect(read(csv([{ ...base, nom: "x".repeat(2 * 1024 * 1024 + 1) }]))).rejects.toThrow();
    const source = Readable.from([Buffer.from(csv([base, base]))]);
    const input = caminoInput(source, 1);
    for await (const row of input.rows) { expect(row.siren).toBe("552081317"); break; }
    expect(() => input.fingerprint()).toThrow();
    expect(source.destroyed).toBe(true);
  });
  it("propage une coupure réseau sans publier", async () => {
    const stream = Readable.from((async function* () {
      yield Buffer.from(csv([base]));
      throw new Error("network");
    })());
    const input = caminoInput(stream, 1);
    await expect((async () => { for await (const row of input.rows) void row; })()).rejects.toThrow();
    expect(() => input.fingerprint()).toThrow();
  });
  it("dédoublonne les clés au sein du lot et utilise un upsert", async () => {
    let values: unknown, query = "";
    const tx = (first: unknown, ...args: unknown[]) => {
      if (Array.isArray(first) && "raw" in first) { query = first.join("?"); void args; return Promise.resolve([]); }
      values = first; return "values";
    };
    const rows = projectCamino(base);
    await caminoWriter.write(tx as never, "import-id", [...rows, ...rows]);
    expect(values).toEqual([{ ...rows[0], import_id: "import-id" }]);
    expect(query).toContain("on conflict (import_id, title_id, siren) do update");
  });
});
