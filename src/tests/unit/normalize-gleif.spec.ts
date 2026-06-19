import { describe, it, expect } from "vitest";
import { normalizeGleif } from "@/lib/ingestion/normalize-gleif";

const SUBJECT = "co:552032534";

describe("normalizeGleif", () => {
  it("mappe une mère directe en nœud company + arête DETIENT structurelle (sans %)", () => {
    const { entities, edges } = normalizeGleif(
      {
        subject: { lei: "969500JBYTLER5DCB263", legalName: "DANONE", country: "FR", registeredAs: "552032534" },
        directParent: { lei: "PARENTLEI0000000000AA", legalName: "HOLDING MERE SA", country: "LU" },
        ultimateParent: null,
      },
      SUBJECT,
    );
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("company");
    expect(entities[0].id).toBe("co:lei:PARENTLEI0000000000AA");
    expect(entities[0].attributes?.LEI).toBe("PARENTLEI0000000000AA");
    expect(entities[0].attributes?.Pays).toBe("LU");
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("DETIENT");
    expect(edges[0].source).toBe("co:lei:PARENTLEI0000000000AA");
    expect(edges[0].target).toBe(SUBJECT);
    expect(edges[0].evidenceLevel).toBe("declared");
    // Aucune participation chiffrée publiée par GLEIF → pas de poids exploitable.
    expect(edges[0].weight).toBeUndefined();
  });

  it("expose le LEI du sujet pour enrichissement", () => {
    const { subjectLei } = normalizeGleif(
      { subject: { lei: "969500JBYTLER5DCB263", legalName: "DANONE", country: "FR", registeredAs: "552032534" }, directParent: null, ultimateParent: null },
      SUBJECT,
    );
    expect(subjectLei).toBe("969500JBYTLER5DCB263");
  });

  it("ne crée qu'une arête quand mère ultime == mère directe", () => {
    const { entities, edges } = normalizeGleif(
      {
        subject: { lei: "L1", legalName: "SUJET", country: "FR", registeredAs: "111222333" },
        directParent: { lei: "PARENT", legalName: "MERE", country: "BE" },
        ultimateParent: { lei: "PARENT", legalName: "MERE", country: "BE" },
      },
      SUBJECT,
    );
    expect(entities).toHaveLength(1);
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe("mère directe");
  });

  it("crée deux nœuds quand mère directe et mère ultime diffèrent", () => {
    const { entities, edges } = normalizeGleif(
      {
        subject: { lei: "L1", legalName: "SUJET", country: "FR", registeredAs: "111222333" },
        directParent: { lei: "DIRECT", legalName: "MERE DIRECTE", country: "DE" },
        ultimateParent: { lei: "ULTIME", legalName: "MERE ULTIME", country: "US" },
      },
      SUBJECT,
    );
    expect(entities).toHaveLength(2);
    expect(edges).toHaveLength(2);
  });

  it("ne lève pas sur une entrée vide ou nulle", () => {
    expect(() => normalizeGleif({}, SUBJECT)).not.toThrow();
    expect(() => normalizeGleif(null, SUBJECT)).not.toThrow();
    const { entities, edges, subjectLei } = normalizeGleif(null, SUBJECT);
    expect(entities).toHaveLength(0);
    expect(edges).toHaveLength(0);
    expect(subjectLei).toBeNull();
  });
});
