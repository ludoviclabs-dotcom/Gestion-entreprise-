import { describe, expect, it } from "vitest";
import { FixtureCasesRepository } from "@/lib/data/fixture-repository";
import { seedJournalFor } from "@/lib/audit/fixture-journal";
import { buildCreationProofEvents } from "@/lib/audit/journal";
import { verifyChain } from "@/lib/audit/hash-chain";
import { demoBundle } from "@/lib/fixtures/case-demo";

const HEX64 = /^[0-9a-f]{64}$/;

describe("journal de preuve (Étape 3.4 audit_logs)", () => {
  it("seed fixture : déterministe, chaîne vérifiable, kinds attendus", () => {
    const first = seedJournalFor("demo-holding");
    const second = seedJournalFor("demo-holding");
    expect(first).toEqual(second); // horodatages fixes → seed stable

    expect(first[0]?.kind).toBe("dossier_cree");
    // demoSources("sirene","bodacc","inpi","tresor_gels") → 4 consultations.
    expect(first.filter((e) => e.kind === "source_consultee")).toHaveLength(4);
    expect(first.some((e) => e.kind === "risque_calcule")).toBe(true);
    expect(verifyChain(first)).toEqual({ ok: true });

    expect(seedJournalFor("dossier-inconnu")).toEqual([]);
  });

  it("seed holding-ubo : l'écart UBO déclaré/recalculé est journalisé", () => {
    const events = seedJournalFor("holding-ubo");
    const ecart = events.find((e) => e.kind === "ecart_ubo_detecte");
    expect(ecart).toBeDefined();
    expect(ecart?.payload.ruleId).toBe("ECART_UBO_DECLARE");
    // Comptes structurés (AMLR : signalement des divergences) : 3 déclarés
    // (MOREAU, HADDAD, LEROY), 3 recalculés, 2 divergences (LEROY nominee
    // absent du capital + BENALI omis du registre).
    expect(ecart?.payload.declares).toBe(3);
    expect(ecart?.payload.recalcules).toBe(3);
    expect(ecart?.payload.divergences).toBe(2);
    // Trace de la source registre (fixture INPI).
    expect(ecart?.payload.sourceEndpoint).toBe("fixture:inpi");
    // Agrégats uniquement — aucun nom de personne (CJUE).
    expect(JSON.stringify(ecart?.payload)).not.toContain("MOREAU");
    expect(verifyChain(events)).toEqual({ ok: true });
  });

  it("buildCreationProofEvents : séquence chaînée + hash des payloads source", () => {
    const events = buildCreationProofEvents({
      caseId: "test-1",
      bundle: demoBundle,
      sources: [
        {
          source: "sirene",
          endpoint: "fixture:sirene",
          httpStatus: 0,
          isFixture: true,
          raw: { unite: "légale" },
        },
      ],
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(events.slice(0, 3).map((e) => e.kind)).toEqual([
      "dossier_cree",
      "source_consultee",
      "risque_calcule",
    ]);
    expect(String(events[1].payload.payloadHash)).toMatch(HEX64);
    expect(verifyChain(events)).toEqual({ ok: true });
  });

  it("createCaseFromSiren journalise la création (mode démo, zéro clé)", async () => {
    const repo = new FixtureCasesRepository();
    const summary = await repo.createCaseFromSiren("552032534");
    const events = await repo.listProofEvents(summary.id);

    expect(events[0]?.kind).toBe("dossier_cree");
    // assembleCase : Sirene UL + établissement, BAN, BODACC, INPI, gels, OpenSanctions, GLEIF, VIES.
    expect(events.filter((e) => e.kind === "source_consultee")).toHaveLength(9);
    expect(events.some((e) => e.kind === "risque_calcule")).toBe(true);
    expect(verifyChain(events)).toEqual({ ok: true });
  });

  it("saveSynthesis chaîne synthese_enregistree (empreinte, pas le texte)", async () => {
    const repo = new FixtureCasesRepository();
    const summary = await repo.createCaseFromSiren("552032534");
    const contenu =
      "Synthèse : dossier de démonstration. Éléments de vigilance : aucun.";
    await repo.saveSynthesis(summary.id, contenu);

    const events = await repo.listProofEvents(summary.id);
    const last = events[events.length - 1];
    expect(last.kind).toBe("synthese_enregistree");
    expect(last.payload.longueur).toBe(contenu.length);
    expect(String(last.payload.contenuHash)).toMatch(HEX64);
    expect(JSON.stringify(last.payload)).not.toContain("démonstration");
    expect(verifyChain(events)).toEqual({ ok: true });
  });

  it("appendProofEvent sur un dossier fixture chaîne après le seed", async () => {
    const repo = new FixtureCasesRepository();
    await repo.appendProofEvent("demo-holding", "export_genere", {
      format: "json",
    });
    const events = await repo.listProofEvents("demo-holding");
    expect(events[events.length - 1].kind).toBe("export_genere");
    // La chaîne combinée seed ⊕ appends runtime reste intègre.
    expect(verifyChain(events)).toEqual({ ok: true });
  });
});
