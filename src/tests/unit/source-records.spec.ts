import { describe, expect, it } from "vitest";
import { fixtureSourceRecordDetails } from "@/lib/data/source-records";
import { FixtureCasesRepository } from "@/lib/data/fixture-repository";
import { seedJournalFor } from "@/lib/audit/fixture-journal";

const HEX64 = /^[0-9a-f]{64}$/;

describe("enregistrements source (inspecteur de preuve)", () => {
  it("fixtures : payloads d'exemple résolus + empreintes", () => {
    const records = fixtureSourceRecordDetails("demo-holding");
    expect(records).toHaveLength(4); // sirene, bodacc, inpi, tresor_gels

    for (const record of records) {
      expect(record.payloadHash).toMatch(HEX64);
      expect(record.isFixture).toBe(true);
    }
    // L'alias générique `fixture:sirene` se résout vers un payload objet
    // (sample Sirene), pas le repli « endpoint en chaîne ».
    const sirene = records.find((r) => r.source === "sirene");
    expect(typeof sirene?.payload).toBe("object");

    expect(fixtureSourceRecordDetails("dossier-inconnu")).toEqual([]);
  });

  it("les empreintes corroborent le journal seedé (source_consultee)", () => {
    const records = fixtureSourceRecordDetails("demo-holding");
    const consultations = seedJournalFor("demo-holding").filter(
      (e) => e.kind === "source_consultee",
    );
    for (const event of consultations) {
      const record = records.find((r) => r.endpoint === event.payload.endpoint);
      expect(record).toBeDefined();
      expect(event.payload.payloadHash).toBe(record?.payloadHash);
    }
  });

  it("dossiers de session : payload brut des connecteurs conservé", async () => {
    const repo = new FixtureCasesRepository();
    const summary = await repo.createCaseFromSiren("552032534");
    const records = await repo.getSourceRecords(summary.id);

    expect(records).toHaveLength(10); // Sirene ×2, BAN, BODACC, INPI, gels, OpenSanctions, GLEIF, VIES, GDELT
    for (const record of records) {
      expect(record.payload).toBeDefined();
      expect(record.payloadHash).toMatch(HEX64);
    }

    // Corroboration avec le journal de création.
    const events = await repo.listProofEvents(summary.id);
    const consultations = events.filter((e) => e.kind === "source_consultee");
    expect(consultations.map((e) => e.payload.payloadHash).sort()).toEqual(
      records.map((r) => r.payloadHash).sort(),
    );
  });
});
