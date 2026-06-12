import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  canonicalJson,
  computeEntryHash,
  payloadHash,
  sha256,
  verifyChain,
} from "@/lib/audit/hash-chain";
import { chainNext } from "@/lib/audit/journal";

const HEX64 = /^[0-9a-f]{64}$/;

describe("hash-chain", () => {
  it("canonicalJson trie les clés récursivement (objets imbriqués + tableaux)", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ f: 1, e: 2 }] } })).toBe(
      '{"a":{"c":[{"e":2,"f":1}],"d":2},"b":1}',
    );
    // Deux ordres d'insertion différents → mêmes octets.
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it("sha256 et payloadHash produisent 64 hex déterministes", () => {
    expect(sha256("abc")).toMatch(HEX64);
    expect(sha256("abc")).toBe(sha256("abc"));
    // payloadHash : convention source_records (JSON.stringify verbatim).
    expect(payloadHash({ a: 1 })).toBe(sha256(JSON.stringify({ a: 1 })));
    expect(payloadHash("texte")).toBe(sha256("texte"));
  });

  it("computeEntryHash couvre prevHash, seq, kind, occurredAt et payload", () => {
    const base = {
      caseId: "c1",
      seq: 1,
      kind: "dossier_cree",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: { titre: "T" },
      prevHash: GENESIS_HASH,
    };
    const h = computeEntryHash(base);
    expect(h).toMatch(HEX64);
    expect(computeEntryHash({ ...base, seq: 2 })).not.toBe(h);
    expect(computeEntryHash({ ...base, payload: { titre: "U" } })).not.toBe(h);
    expect(
      computeEntryHash({ ...base, occurredAt: "2026-01-01T00:00:00.001Z" }),
    ).not.toBe(h);
  });

  it("chaîne valide, falsification détectée à l'index exact", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const e1 = chainNext(null, {
      caseId: "c1",
      kind: "dossier_cree",
      occurredAt: at,
      payload: { titre: "T" },
    });
    const e2 = chainNext(e1, {
      caseId: "c1",
      kind: "risque_calcule",
      occurredAt: at,
      payload: { reglesDeclenchees: [] },
    });
    const e3 = chainNext(e2, {
      caseId: "c1",
      kind: "export_genere",
      occurredAt: at,
      payload: { format: "json" },
    });

    expect(e1.prevHash).toBe(GENESIS_HASH);
    expect(e2.prevHash).toBe(e1.entryHash);
    expect(verifyChain([e1, e2, e3])).toEqual({ ok: true });

    // Altération du payload d'une entrée passée → cassure à son index.
    const tampered = [e1, { ...e2, payload: { falsifie: true } }, e3];
    expect(verifyChain(tampered)).toEqual({ ok: false, brokenAt: 1 });

    // Suppression d'une entrée intermédiaire → rebouclage rompu.
    expect(verifyChain([e1, e3])).toEqual({ ok: false, brokenAt: 1 });

    // Genèse incorrecte.
    expect(verifyChain([{ ...e1, prevHash: "1".repeat(64) }])).toEqual({
      ok: false,
      brokenAt: 0,
    });
  });
});
