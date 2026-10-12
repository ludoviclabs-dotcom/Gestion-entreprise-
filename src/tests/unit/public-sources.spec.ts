import { describe, expect, it } from "vitest";
import { getConnectorStatuses } from "@/lib/connectors/status";
import {
  NON_PUBLIC_CONNECTOR_KEYS,
  PUBLIC_FAMILIES,
  PUBLIC_SOURCES,
  SOURCE_STATE_LABEL,
  familySummaries,
  publicSourceCounts,
  sourcesIntro,
  sourcesOfFamily,
} from "@/lib/domain/public-sources";

describe("catalogue public des sources", () => {
  const connectorKeys = getConnectorStatuses().map((c) => c.key);

  it("couvre chaque connecteur de l'application, sans en inventer", () => {
    const expected = connectorKeys.filter((k) => !NON_PUBLIC_CONNECTOR_KEYS.includes(k)).sort();
    const published = PUBLIC_SOURCES.map((s) => s.key).sort();
    // Un nouveau connecteur doit recevoir une ligne publique (ou être listé comme non public).
    expect(published).toEqual(expected);
  });

  it("n'a ni doublon de clé ni famille inconnue, et chaque famille est servie", () => {
    const keys = PUBLIC_SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    const families = new Set(PUBLIC_FAMILIES.map((f) => f.id));
    expect(PUBLIC_SOURCES.every((s) => families.has(s.family))).toBe(true);
    for (const f of PUBLIC_FAMILIES) expect(sourcesOfFamily(f.id).length).toBeGreaterThan(0);
  });

  it("renseigne chaque source (nom, description, accès, état connu) et sans formule trompeuse", () => {
    for (const s of PUBLIC_SOURCES) {
      expect(s.name.trim()).not.toBe("");
      expect(s.text.trim()).not.toBe("");
      expect(s.access.trim()).not.toBe("");
      expect(Object.keys(SOURCE_STATE_LABEL)).toContain(s.state);
    }
    // Une source « en cours » ou « partielle » explique pourquoi.
    for (const s of PUBLIC_SOURCES.filter((x) => x.state !== "actif")) {
      expect(s.note, s.key).toBeTruthy();
    }
    const all = JSON.stringify(PUBLIC_SOURCES) + sourcesIntro();
    expect(all).not.toMatch(/API officielles uniquement/i);
  });

  it("conserve OpenSanctions et l'objectif PEP, marqués « en cours »", () => {
    const os = PUBLIC_SOURCES.find((s) => s.key === "opensanctions");
    expect(os?.state).toBe("en_cours");
    expect(os?.text).toMatch(/personnes politiquement exposées/i);
    expect(os?.note).toMatch(/en cours/i);
  });

  it("calcule les compteurs et le chapeau à partir du catalogue", () => {
    const counts = publicSourceCounts();
    expect(counts.total).toBe(PUBLIC_SOURCES.length);
    expect(counts.active + counts.inProgress).toBe(counts.total);
    expect(counts.inProgress).toBe(PUBLIC_SOURCES.filter((s) => s.state === "en_cours").length);
    const intro = sourcesIntro(counts);
    expect(intro).toContain(`${counts.active} sources publiques actives`);
    expect(intro).toContain(`${counts.inProgress} en cours`);
    expect(intro).toMatch(/jamais de scraping/);
    // Sans source en cours, la mention disparaît.
    expect(sourcesIntro({ total: 3, active: 3, partial: 0, inProgress: 0 })).not.toMatch(/en cours/);
  });

  it("résume chaque famille sans lister les sources « en cours » comme actives", () => {
    const rows = familySummaries();
    expect(rows).toHaveLength(PUBLIC_FAMILIES.length);
    const sanctions = rows.find((r) => r.id === "sanctions")!;
    expect(sanctions.names).toContain("DG Trésor");
    expect(sanctions.names).not.toContain("OpenSanctions");
    expect(sanctions.inProgress).toBe(1);
    expect(rows.reduce((n, r) => n + r.active, 0)).toBe(publicSourceCounts().active);
    expect(rows.find((r) => r.id === "presse")?.partial).toBe(1);
  });
});
