import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import postgres from "postgres";
import {
  birthYearsIn,
  parseCa,
  parseCh,
  parseCsl,
  parseUk,
  parseUn,
  sanctionsInput,
  sanctionsWriter,
} from "../../../scripts/import/sanctions";
import { GROUPS, SANCTION_SOURCES, sourcesFor } from "../../../scripts/import/lib/groups";
import { requiredKeyOverlap, sanctionKeys } from "@/lib/connectors/sanctions-lists";

const csv = (rows: Record<string, string>[]) => {
  const cols = ["_id", "source", "entity_number", "type", "programs", "name", "addresses", "alt_names", "start_date", "dates_of_birth", "remarks"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
};

describe("parseCsl — liste consolidée américaine", () => {
  const text = csv([
    { _id: "a1", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Entity", programs: "RUSSIA-EO14024; UKRAINE-EO13662", name: "ACME HOLDING JSC", alt_names: "ACME HOLD; AKME", addresses: "1 Rue X, Moscow, 101000, RU; 2 Road Y, Dubai, AE", start_date: "2022-03-24" },
    { _id: "a2", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Individual", name: "DUPONT Jean", dates_of_birth: "1970-01-01" },
    { _id: "a3", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Vessel", name: "NAVIRE FANTOME" },
    { _id: "a4", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Aircraft", name: "AVION FANTOME" },
    { _id: "b1", source: "Entity List (EL) - Bureau of Industry and Security", type: "", name: "Fictive Trading Co., Ltd." },
    { _id: "b2", source: "Denied Persons List (DPL) - Bureau of Industry and Security", type: "", name: "Martin Durand" },
    { _id: "a1", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Entity", name: "AUTRE ENTITE DOUBLON" },
    { _id: "c1", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Entity", name: "ООО Только Кириллица" },
  ]);

  it("ne garde que les organisations, jamais personnes, navires ni aéronefs", () => {
    const { rows, stats } = parseCsl(text);
    expect(stats).toMatchObject({ received: 8, individuals: 1, vessels: 2, nonLatin: 1 });
    expect(rows.map((r) => r.name)).toEqual([
      "ACME HOLDING JSC", "Fictive Trading Co., Ltd.", "Martin Durand", "AUTRE ENTITE DOUBLON",
    ]);
  });

  it("projette liste, programmes, pays et date ; type vide → « unknown »", () => {
    const { rows } = parseCsl(text);
    expect(rows[0]).toMatchObject({
      list_key: "us", entry_key: "a1", sublist: "SDN — OFAC (Trésor)", kind: "entity",
      programs: ["RUSSIA-EO14024", "UKRAINE-EO13662"], countries: ["RU", "AE"],
      listed_on: "2022-03-24", aliases: ["ACME HOLD", "AKME"],
    });
    expect(rows.find((r) => r.name === "Fictive Trading Co., Ltd.")).toMatchObject({ kind: "unknown", sublist: "Entity List — BIS (Commerce)" });
    // Aucune adresse, date de naissance ni remarque dans la projection.
    expect(JSON.stringify(rows)).not.toMatch(/Rue X|1970|DUPONT|remarks/);
  });

  it("garantit l'unicité de la clé d'entrée même si l'identifiant se répète", () => {
    const { rows } = parseCsl(text);
    const keys = rows.map((r) => r.entry_key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("a1~2");
  });

  it("refuse un fichier d'un autre format", () => {
    expect(() => parseCsl("colonne,autre\n1,2")).toThrow("SANCTIONS_US_SCHEMA");
  });
});

describe("parseUk — UK Sanctions List", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?><Designations><DateGenerated>08/10/2026</DateGenerated>
  <Designation><UniqueID>RUS0001</UniqueID><OFSIGroupID>1</OFSIGroupID><DateDesignated>29/06/2012</DateDesignated>
    <Names><Name><Name6>Sample Defence JSC</Name6><NameType>Primary Name</NameType></Name>
      <Name><Name6>Sample Def</Name6><NameType>Alias</NameType></Name>
      <Name><NameType>Primary Name Variation</NameType></Name></Names>
    <RegimeName>The Russia (Sanctions) (EU Exit) Regulations 2019</RegimeName><IndividualEntityShip>Entity</IndividualEntityShip>
    <Addresses><Address><AddressLine1>1 Rue Secrete</AddressLine1><AddressCountry>Russia</AddressCountry></Address></Addresses></Designation>
  <Designation><UniqueID>RUS0002</UniqueID><Names><Name><Name6>Smith</Name6><Name1>John</Name1><NameType>Primary Name</NameType></Name></Names><IndividualEntityShip>Individual</IndividualEntityShip></Designation>
  <Designation><UniqueID>RUS0003</UniqueID><Names><Name><Name6>MV Fantome</Name6><NameType>Primary Name</NameType></Name></Names><IndividualEntityShip>Ship</IndividualEntityShip></Designation>
  </Designations>`;

  it("conserve les entités, écarte personnes et navires, n'invente pas de nom vide", () => {
    const { rows, stats } = parseUk(xml);
    expect(stats).toMatchObject({ received: 3, individuals: 1, vessels: 1, kept: 1 });
    expect(rows).toEqual([{
      list_key: "uk", entry_key: "RUS0001", sublist: null, name: "Sample Defence JSC",
      aliases: ["Sample Def"], keys: expect.arrayContaining(["sampl", "defen"]),
      programs: ["The Russia (Sanctions) (EU Exit) Regulations 2019"], countries: ["Russia"],
      listed_on: "2012-06-29", kind: "entity", birth_years: [],
    }]);
    expect(JSON.stringify(rows)).not.toMatch(/Secrete|Smith/);
  });

  it("refuse un document d'un autre schéma", () => {
    expect(() => parseUk("<autre/>")).toThrow("SANCTIONS_UK_SCHEMA");
  });
});

describe("parseUn — liste consolidée du Conseil de sécurité", () => {
  const xml = `<CONSOLIDATED_LIST><INDIVIDUALS><INDIVIDUAL><DATAID>1</DATAID><FIRST_NAME>Personne</FIRST_NAME></INDIVIDUAL></INDIVIDUALS>
  <ENTITIES><ENTITY><DATAID>6908402</DATAID><FIRST_NAME>Groupe Fictif</FIRST_NAME><UN_LIST_TYPE>DRC</UN_LIST_TYPE>
    <REFERENCE_NUMBER>CDe.001</REFERENCE_NUMBER><LISTED_ON>2014-06-30</LISTED_ON>
    <ENTITY_ALIAS><QUALITY>a.k.a.</QUALITY><ALIAS_NAME>Fictive Group</ALIAS_NAME></ENTITY_ALIAS>
    <ENTITY_ALIAS><QUALITY></QUALITY><ALIAS_NAME></ALIAS_NAME></ENTITY_ALIAS>
    <ENTITY_ADDRESS><COUNTRY>Congo</COUNTRY></ENTITY_ADDRESS><COMMENTS1>Texte libre à ne pas conserver</COMMENTS1></ENTITY></ENTITIES></CONSOLIDATED_LIST>`;

  it("projette l'entité, ses alias non vides, son programme et sa date", () => {
    const { rows, stats } = parseUn(xml);
    expect(stats).toMatchObject({ received: 1, individuals: 1, kept: 1 });
    expect(rows[0]).toMatchObject({
      list_key: "un", entry_key: "CDe.001", name: "Groupe Fictif", aliases: ["Fictive Group"],
      programs: ["ONU — DRC"], countries: ["Congo"], listed_on: "2014-06-30", kind: "entity",
    });
    expect(JSON.stringify(rows)).not.toMatch(/Texte libre/);
  });
});

describe("parseCh — SECO (historique inclus)", () => {
  const target = (ssid: string, name: string, mods: string, extra = "") => `<target ssid="${ssid}"><sanctions-set-id>4387</sanctions-set-id>
    <entity><identity ssid="${ssid}1" main="true"><name ssid="${ssid}2" name-type="primary-name" lang="eng"><name-part order="1" name-part-type="whole-name"><value>${name}</value></name-part></name>${extra}</identity>
    <justification ssid="9">Texte libre</justification></entity>${mods}</target>`;
  const xml = `<swiss-sanctions-list list-type="whole-list" date="2026-10-05">
    <sanctions-program ssid="20"><program-key lang="eng">Ukraine</program-key><sanctions-set ssid="4387" lang="eng">art. 12</sanctions-set></sanctions-program>
    ${target("100", "Société Fictive AG", `<modification modification-type="amended" enactment-date="2024-01-01" effective-date="2024-01-02"/><modification modification-type="listed" enactment-date="2022-03-04" effective-date="2022-03-05"/>`)}
    ${target("101", "Société Radiée SA", `<modification modification-type="de-listed" enactment-date="2024-06-01" effective-date="2024-06-02"/><modification modification-type="listed" enactment-date="2020-01-01"/>`)}
    ${target("102", "Société Relistée SA", `<modification modification-type="listed" enactment-date="2025-01-01"/><modification modification-type="de-listed" enactment-date="2023-01-01"/><modification modification-type="listed" enactment-date="2020-01-01"/>`)}
    <target ssid="200"><sanctions-set-id>4387</sanctions-set-id><individual><identity ssid="2001" main="true"><name ssid="2002" name-type="primary-name"><name-part order="1" name-part-type="family-name"><value>Dupont</value></name-part></name></identity></individual><modification modification-type="listed"/></target>
    <target ssid="300"><sanctions-set-id>4387</sanctions-set-id><object object-type="vessel"><identity ssid="3001" main="true"><name ssid="3002" name-type="primary-name"><name-part order="1" name-part-type="whole-name"><value>Navire X</value></name-part></name></identity></object><modification modification-type="listed"/></target>
  </swiss-sanctions-list>`;

  it("n'enregistre que les entités EN VIGUEUR : une radiation décide, une re-inscription l'emporte", () => {
    const { rows, stats } = parseCh(xml);
    expect(stats).toMatchObject({ received: 5, individuals: 1, vessels: 1, delisted: 1, kept: 2 });
    expect(rows.map((r) => r.entry_key)).toEqual(["100", "102"]);
    expect(rows[0]).toMatchObject({ list_key: "ch", name: "Société Fictive AG", programs: ["Suisse — Ukraine"], listed_on: "2022-03-04", kind: "entity" });
    expect(JSON.stringify(rows)).not.toMatch(/Texte libre|Dupont|Navire/);
  });

  it("utilise une variante latine quand le nom principal est cyrillique", () => {
    const cyr = `<swiss-sanctions-list><target ssid="1"><sanctions-set-id>1</sanctions-set-id><entity><identity ssid="11" main="true">
      <name ssid="12" name-type="primary-name"><name-part order="1" name-part-type="whole-name"><value>ООО Пример</value>
      <spelling-variant lang="RUS" script="LATN">OOO Primer</spelling-variant></name-part></name></identity></entity>
      <modification modification-type="listed"/></target></swiss-sanctions-list>`;
    const { rows } = parseCh(cyr);
    expect(rows[0]).toMatchObject({ name: "OOO Primer" });
  });
});

describe("parseCa — mesures spéciales (Canada)", () => {
  const rec = (fields: Record<string, string>) => `<record>${Object.entries(fields).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</record>`;
  const xml = `<data-set>${[
    rec({ "Country-Pays": "Russia / Russie", "EntityOrShip-EntiteOuNavire": "Stroytransgaz OJSC", "Aliases-Alias": "Stroytransgaz Holding / ОАО Стройтрансгаз", "Schedule-Annexe": "1, Part 2", "Item-NumeroDarticle": "16", "DateOfListing-DateDinscription": "2014-05-04" }),
    rec({ "Country-Pays": "Russia / Russie", "EntityOrShip-EntiteOuNavire": "NAVIRE-CITERNE", "ShipIMONumber-NumeroOMIDuNavire": "9000001", "TitleOrShipType-TitreOuTypeDeNavire": "Oil Tanker", "Schedule-Annexe": "1.1", "Item-NumeroDarticle": "1" }),
    rec({ "Country-Pays": "Belarus / Bélarus", "LastName-NomDeFamille": "Atabekov", "GivenName-Prenom": "Khazalbek", "Schedule-Annexe": "1, Part 1", "Item-NumeroDarticle": "1" }),
  ].join("")}</data-set>`;

  it("garde les entités, écarte navires et personnes", () => {
    const { rows, stats } = parseCa(xml);
    expect(stats).toMatchObject({ received: 3, individuals: 1, vessels: 1, kept: 1 });
    expect(rows[0]).toMatchObject({
      list_key: "ca", name: "Stroytransgaz OJSC", aliases: ["Stroytransgaz Holding", "ОАО Стройтрансгаз"],
      programs: ["Canada — Russia"], countries: ["Russia"], listed_on: "2014-05-04", kind: "entity",
    });
    expect(JSON.stringify(rows)).not.toMatch(/Atabekov|Khazalbek|NAVIRE/);
  });
});

describe("sanctionsInput — lecture bornée et publication", () => {
  const stream = (s: string) => Readable.from([Buffer.from(s)]);
  const un = `<CONSOLIDATED_LIST><ENTITIES><ENTITY><DATAID>1</DATAID><FIRST_NAME>Groupe Fictif</FIRST_NAME><REFERENCE_NUMBER>X.1</REFERENCE_NUMBER></ENTITY></ENTITIES></CONSOLIDATED_LIST>`;

  it("publie une empreinte seulement après la projection complète", async () => {
    const input = sanctionsInput("un", stream(un), { minimum: 1 });
    expect(() => input.fingerprint()).toThrow();
    const rows = [];
    for await (const r of input.rows) rows.push(r);
    expect(rows).toHaveLength(1);
    expect(input.fingerprint()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuse un fichier trop petit (tronqué ou schéma changé)", async () => {
    const input = sanctionsInput("un", stream(un));
    await expect((async () => { for await (const r of input.rows) void r; })()).rejects.toThrow("SANCTIONS_UN_INCOMPLETE_SOURCE");
    expect(() => input.fingerprint()).toThrow();
  });

  it("refuse une page d'erreur HTML et borne la taille", async () => {
    const html = sanctionsInput("un", stream("<html><body>503</body></html>"), { minimum: 1 });
    await expect((async () => { for await (const r of html.rows) void r; })()).rejects.toThrow("SANCTIONS_UN_SCHEMA");
    const big = sanctionsInput("un", Readable.from([Buffer.alloc(16 * 1024 * 1024 + 1)]), { minimum: 1 });
    await expect((async () => { for await (const r of big.rows) void r; })()).rejects.toThrow("SOURCE_TOO_LARGE");
  });
});

describe("sanctionsWriter — table partagée par cinq listes", () => {
  it("purge UNIQUEMENT la liste importée, jamais les autres", async () => {
    const queries: string[] = [];
    const tx = vi.fn((first: unknown, ...values: unknown[]) => {
      if (Array.isArray(first) && "raw" in first) {
        queries.push((first as unknown as string[]).join("?") + JSON.stringify(values));
        return Promise.resolve([]);
      }
      return "values";
    });
    await sanctionsWriter("uk").prune(tx as never, "import-new");
    expect(queries[0]).toContain("delete from sanctions_entries where list_key =");
    expect(queries[0]).toContain("and import_id <>");
    expect(queries[0]).toContain('"uk"');
    expect(queries[0]).toContain('"import-new"');
  });

  it("écrit les colonnes jsonb en tableaux (jamais en chaînes) et met à jour sur (import_id, entry_key)", async () => {
    let values: unknown, query = "";
    const tx = (first: unknown) => {
      if (Array.isArray(first) && "raw" in first) { query = first.join("?"); return Promise.resolve([]); }
      values = first;
      return "values";
    };
    await sanctionsWriter("us").write(tx as never, "imp", [{
      list_key: "us", entry_key: "k", sublist: "SDN", name: "ACME", aliases: ["A"], keys: ["acme"],
      programs: ["P"], countries: ["RU"], listed_on: "2022-01-01", kind: "entity", birth_years: [],
    }]);
    expect(query).toContain("on conflict (import_id, entry_key) do update");
    // Le client postgres sérialise lui-même le type jsonb : une chaîne déjà JSON y serait
    // double-encodée et le pré-filtre « ?| » ne trouverait plus rien.
    expect(values).toEqual([
      expect.objectContaining({
        import_id: "imp", aliases: ["A"], keys: ["acme"], programs: ["P"], countries: ["RU"], kind: "entity",
      }),
    ]);
    // Preuve sur le vrai sérialiseur du client : ce qu'il envoie pour le type jsonb
    // (oid 3802) doit être un tableau JSON, pas une chaîne contenant un tableau.
    const serialize = (postgres({ host: "localhost" }).options.serializers as Record<number, (x: unknown) => string>)[3802];
    const row = (values as Record<string, unknown>[])[0];
    for (const column of ["aliases", "keys", "programs", "countries"]) {
      expect(Array.isArray(JSON.parse(serialize(row[column])))).toBe(true);
    }
  });
});

describe("clés de pré-filtrage et groupes d'import", () => {
  it("retire les formes juridiques et les mots courts, tronque à 5 caractères", () => {
    expect(sanctionKeys(["Rosneft Oil Company SA", "ООО Пример"])).toEqual(["rosne", "oil", "compa"]);
    expect(requiredKeyOverlap(["rosne"])).toBe(1);
    expect(requiredKeyOverlap(["rosne", "oil"])).toBe(2);
    expect(requiredKeyOverlap([])).toBe(1);
  });

  it("« daily » = registre des gels + listes internationales ; « all » = tout", () => {
    expect(GROUPS.daily).toEqual(["tresor_gels", ...SANCTION_SOURCES]);
    expect(sourcesFor("all")).toEqual(expect.arrayContaining(["camino", "icpe", "tresor_gels", ...SANCTION_SOURCES]));
    expect(sourcesFor("sanctions")).toEqual(SANCTION_SOURCES);
    expect(sourcesFor("sanctions_uk")).toEqual(["sanctions_uk"]);
    expect(sourcesFor("check")).toEqual([]);
    expect(sourcesFor("inconnu")).toBeUndefined();
  });
});

describe("downloadWithRedirects — redirections contrôlées", () => {
  const response = (status: number, headers: Record<string, string> = {}, body: string | null = "<ok/>") =>
    new Response(body, { status, headers });

  async function run(fetchImpl: (url: string) => Response, hosts: string[]) {
    const { downloadWithRedirects } = await import("../../../scripts/import/lib/stream");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return fetchImpl(url);
    }));
    try {
      const stream = await downloadWithRedirects("https://source.test/liste.xml", new AbortController().signal, {}, hosts);
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(Buffer.from(c));
      return { body: Buffer.concat(chunks).toString(), calls };
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it("suit une redirection vers un hôte autorisé", async () => {
    const r = await run((url) => url.includes("source.test")
      ? response(302, { location: "https://stockage.test/fichier.xml?sig=SECRET" }, null)
      : response(200), ["stockage.test"]);
    expect(r.body).toBe("<ok/>");
    expect(r.calls).toHaveLength(2);
  });

  it("refuse un hôte non autorisé, un lien non HTTPS et les boucles", async () => {
    await expect(run(() => response(302, { location: "https://ailleurs.test/x" }, null), ["stockage.test"]))
      .rejects.toThrow("REDIRECT_HOST_NOT_ALLOWED");
    await expect(run(() => response(302, { location: "http://stockage.test/x" }, null), ["stockage.test"]))
      .rejects.toThrow("INVALID_SOURCE_URL");
    await expect(run(() => response(302, { location: "https://stockage.test/x" }, null), ["stockage.test"]))
      .rejects.toThrow("TOO_MANY_REDIRECTS");
  });

  it("refuse une erreur HTTP et toute redirection quand aucun hôte n'est autorisé", async () => {
    await expect(run(() => response(503, {}, "panne"), [])).rejects.toThrow("SOURCE_HTTP_ERROR");
    await expect(run(() => response(301, { location: "https://stockage.test/x" }, null), []))
      .rejects.toThrow("REDIRECT_HOST_NOT_ALLOWED");
  });
});

describe("personnes physiques — importées seulement quand le drapeau est posé", () => {
  const previous = process.env.SANCTIONS_PERSONS_IMPORT_ENABLED;
  beforeEach(() => { process.env.SANCTIONS_PERSONS_IMPORT_ENABLED = "true"; });
  afterEach(() => {
    if (previous === undefined) delete process.env.SANCTIONS_PERSONS_IMPORT_ENABLED;
    else process.env.SANCTIONS_PERSONS_IMPORT_ENABLED = previous;
  });

  it("birthYearsIn : années plausibles seulement, jamais la date complète", () => {
    expect(birthYearsIn(["1955-09-24", "circa 1951; 16 Jan 1969", "dd/mm/1945"])).toEqual([1945, 1951, 1955, 1969]);
    expect(birthYearsIn(["0206", "2099", "12345678", ""])).toEqual([]);
  });

  it("États-Unis : nom, alias, années de naissance, pays ; aucune date complète ni remarque", () => {
    const text = csv([
      { _id: "p1", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Individual", programs: "BELARUS", name: "Dzmitry LUKASHENKA", alt_names: "Dmitri LUKASHENKO; D. LUKASHENKA", dates_of_birth: "1980-03-23; 1980", start_date: "2020-09-25", remarks: "Texte libre confidentiel" },
      { _id: "p2", source: "Palestinian Legislative Council (PLC) - Treasury Department", type: "Individual", name: "Mohammed ABU TEIR", dates_of_birth: "circa 1951" },
      { _id: "e1", source: "Specially Designated Nationals (SDN) - Treasury Department", type: "Entity", name: "ACME HOLDING JSC" },
    ]);
    const { rows, stats } = parseCsl(text);
    const persons = rows.filter((r) => r.kind === "person");
    expect(stats).toMatchObject({ persons: 2, individuals: 0 });
    expect(persons[0]).toMatchObject({
      list_key: "us", entry_key: "p1", name: "Dzmitry LUKASHENKA", birth_years: [1980],
      aliases: ["Dmitri LUKASHENKO", "D. LUKASHENKA"], listed_on: "2020-09-25",
    });
    expect(persons[0].keys).toEqual(expect.arrayContaining(["dzmit", "lukas"]));
    expect(persons[1].birth_years).toEqual([1951]);
    expect(rows.find((r) => r.kind === "entity")?.birth_years).toEqual([]);
    expect(JSON.stringify(rows)).not.toMatch(/1980-03-23|Texte libre/);
  });

  it("Royaume-Uni : prénoms + nom, années (dd/mm/AAAA), nationalité", () => {
    const xml = `<Designations>
      <Designation><UniqueID>AFG0006</UniqueID><DateDesignated>25/01/2001</DateDesignated>
        <Names><Name><Name1>MOHAMMAD</Name1><Name2>HASSAN</Name2><Name6>AKHUND</Name6><NameType>Primary Name</NameType></Name>
          <Name><Name1>Hassan</Name1><Name6>Akhund</Name6><NameType>Alias</NameType></Name></Names>
        <RegimeName>The Afghanistan (Sanctions) (EU Exit) Regulations 2020</RegimeName><IndividualEntityShip>Individual</IndividualEntityShip>
        <IndividualDetails><Individual><DOBs><DOB>dd/mm/1945</DOB><DOB>15/03/1950</DOB></DOBs>
          <PassportDetails><Passport><PassportNumber>P04581926</PassportNumber></Passport></PassportDetails>
          <Nationalities><Nationality>Afghanistan</Nationality></Nationalities></Individual></IndividualDetails></Designation></Designations>`;
    const { rows, stats } = parseUk(xml);
    expect(stats).toMatchObject({ persons: 1, individuals: 0 });
    expect(rows[0]).toMatchObject({
      kind: "person", name: "MOHAMMAD HASSAN AKHUND", aliases: ["Hassan Akhund"],
      birth_years: [1945, 1950], countries: ["Afghanistan"], listed_on: "2001-01-25",
    });
    expect(JSON.stringify(rows)).not.toMatch(/P04581926|15\/03/);
  });

  it("ONU : prénoms, alias non vides, année (YEAR / plage), nationalité", () => {
    const xml = `<CONSOLIDATED_LIST><INDIVIDUALS>
      <INDIVIDUAL><DATAID>1</DATAID><FIRST_NAME>ERIC</FIRST_NAME><SECOND_NAME>BADEGE</SECOND_NAME><UN_LIST_TYPE>DRC</UN_LIST_TYPE>
        <REFERENCE_NUMBER>CDi.001</REFERENCE_NUMBER><LISTED_ON>2012-12-31</LISTED_ON><COMMENTS1>Texte libre</COMMENTS1>
        <NATIONALITY><VALUE>Democratic Republic of the Congo</VALUE></NATIONALITY>
        <INDIVIDUAL_ALIAS><QUALITY/><ALIAS_NAME/></INDIVIDUAL_ALIAS>
        <INDIVIDUAL_ALIAS><QUALITY>a.k.a.</QUALITY><ALIAS_NAME>Eric Badege Lukwebo</ALIAS_NAME></INDIVIDUAL_ALIAS>
        <INDIVIDUAL_DATE_OF_BIRTH><TYPE_OF_DATE>BETWEEN</TYPE_OF_DATE><FROM_YEAR>1970</FROM_YEAR><TO_YEAR>1972</TO_YEAR></INDIVIDUAL_DATE_OF_BIRTH>
      </INDIVIDUAL></INDIVIDUALS>
      <ENTITIES><ENTITY><DATAID>2</DATAID><FIRST_NAME>Groupe Fictif</FIRST_NAME><UN_LIST_TYPE>DRC</UN_LIST_TYPE><REFERENCE_NUMBER>CDe.001</REFERENCE_NUMBER></ENTITY></ENTITIES></CONSOLIDATED_LIST>`;
    const { rows, stats } = parseUn(xml);
    expect(stats).toMatchObject({ persons: 1, individuals: 0 });
    const person = rows.find((r) => r.kind === "person");
    expect(person).toMatchObject({
      entry_key: "CDi.001", name: "ERIC BADEGE", aliases: ["Eric Badege Lukwebo"],
      birth_years: [1970, 1972], countries: ["Democratic Republic of the Congo"], listed_on: "2012-12-31",
    });
    expect(rows.some((r) => r.kind === "entity" && r.name === "Groupe Fictif")).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/Texte libre/);
  });

  it("Suisse : nom assemblé, année du day-month-year ; une personne radiée n'est pas conservée", () => {
    const person = (ssid: string, mods: string) => `<target ssid="${ssid}"><sanctions-set-id>4387</sanctions-set-id><individual>
      <identity ssid="${ssid}1" main="true"><name ssid="${ssid}2" name-type="primary-name">
        <name-part order="1" name-part-type="family-name"><value>Lukashenka</value></name-part>
        <name-part order="2" name-part-type="given-name"><value>Dzmitry</value></name-part></name>
        <day-month-year ssid="9" day="23" month="3" year="1980"/><address ssid="8"><address-details>Rue secrète</address-details></address></identity>
      </individual>${mods}</target>`;
    const xml = `<swiss-sanctions-list>
      <sanctions-program ssid="20"><program-key lang="eng">Belarus</program-key><sanctions-set ssid="4387" lang="eng">art. 12</sanctions-set></sanctions-program>
      ${person("500", `<modification modification-type="listed" enactment-date="2020-09-25"/>`)}
      ${person("501", `<modification modification-type="de-listed" enactment-date="2024-06-01"/><modification modification-type="listed" enactment-date="2020-01-01"/>`)}
    </swiss-sanctions-list>`;
    const { rows, stats } = parseCh(xml);
    expect(stats).toMatchObject({ persons: 1, delisted: 1, individuals: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "person", entry_key: "500", name: "Lukashenka Dzmitry", birth_years: [1980], programs: ["Suisse — Belarus"], listed_on: "2020-09-25" });
    expect(JSON.stringify(rows)).not.toMatch(/Rue secrète|23/);
  });

  it("Canada : prénom + nom, année", () => {
    const rec = (fields: Record<string, string>) => `<record>${Object.entries(fields).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</record>`;
    const xml = `<data-set>${[
      rec({ "Country-Pays": "Belarus / Bélarus", "LastName-NomDeFamille": "Balaba", "GivenName-Prenom": "Dmitry Vladimirovich", "DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire": "1972", "Schedule-Annexe": "1, Part 1", "Item-NumeroDarticle": "2", "DateOfListing-DateDinscription": "2020-09-28" }),
    ].join("")}</data-set>`;
    const { rows, stats } = parseCa(xml);
    expect(stats).toMatchObject({ persons: 1, individuals: 0 });
    expect(rows[0]).toMatchObject({ kind: "person", name: "Dmitry Vladimirovich Balaba", birth_years: [1972], programs: ["Canada — Belarus"] });
  });

  it("écrit la colonne birth_years seulement quand les personnes sont importées", async () => {
    const written: Record<string, unknown>[][] = [];
    const tx = Object.assign(
      (first: unknown) => {
        if (Array.isArray(first) && "raw" in first) return Promise.resolve([]);
        written.push(first as Record<string, unknown>[]);
        return "values";
      },
      {},
    );
    const row = {
      list_key: "us" as const, entry_key: "k", sublist: null, name: "X Y", aliases: [], keys: ["x"], programs: [],
      countries: [], listed_on: null, kind: "person" as const, birth_years: [1970],
    };
    await sanctionsWriter("us").write(tx as never, "imp", [row]);
    expect(written[0][0]).toMatchObject({ birth_years: [1970], kind: "person" });
    process.env.SANCTIONS_PERSONS_IMPORT_ENABLED = "false";
    await sanctionsWriter("us").write(tx as never, "imp", [{ ...row, kind: "entity" as const, birth_years: [] }]);
    expect("birth_years" in written[1][0]).toBe(false);
  });
});
