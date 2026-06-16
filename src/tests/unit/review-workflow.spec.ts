import { describe, it, expect } from "vitest";
import {
  reviewStateFromEvents,
  reviewTransitionError,
  REVIEW_TRANSITIONS,
  type ProofEvent,
  type ProofEventKind,
  type ReviewState,
} from "@/lib/audit/journal";

function ev(kind: ProofEventKind, to?: ReviewState): ProofEvent {
  return {
    id: "x",
    caseId: "c",
    seq: 1,
    kind,
    occurredAt: "2026-01-01T00:00:00.000Z",
    payload: to ? { to } : {},
    prevHash: "",
    entryHash: "",
  };
}

describe("axe de revue (P4) — projection depuis le journal", () => {
  it("part de « à trier » sans transition", () => {
    expect(reviewStateFromEvents([])).toBe("a_trier");
    expect(reviewStateFromEvents([ev("dossier_cree")])).toBe("a_trier");
  });

  it("reflète la dernière transition journalisée", () => {
    expect(reviewStateFromEvents([ev("revue_transition", "en_revue")])).toBe(
      "en_revue",
    );
    expect(
      reviewStateFromEvents([
        ev("revue_transition", "en_revue"),
        ev("revue_transition", "conclu"),
      ]),
    ).toBe("conclu");
  });

  it("interdit de conclure sans revue (a_trier ↛ conclu)", () => {
    expect(REVIEW_TRANSITIONS.a_trier).toEqual(["en_revue"]);
    expect(REVIEW_TRANSITIONS.a_trier).not.toContain("conclu");
    expect(REVIEW_TRANSITIONS.en_revue).toContain("conclu");
    expect(REVIEW_TRANSITIONS.en_revue).toContain("a_trier");
    expect(REVIEW_TRANSITIONS.conclu).toEqual(["en_revue"]);
  });
});

describe("garde humaine de conclusion (reviewTransitionError)", () => {
  it("rejette une transition non autorisée", () => {
    expect(
      reviewTransitionError({
        from: "a_trier",
        to: "conclu",
        highBand: false,
        noteLength: 0,
      }),
    ).toMatch(/non autorisée/);
  });

  it("exige un outcome pour conclure", () => {
    expect(
      reviewTransitionError({
        from: "en_revue",
        to: "conclu",
        highBand: false,
        noteLength: 0,
      }),
    ).toMatch(/conclusion/i);
  });

  it("autorise une conclusion standard hors bande haute sans note", () => {
    expect(
      reviewTransitionError({
        from: "en_revue",
        to: "conclu",
        outcome: "vigilance_standard",
        highBand: false,
        noteLength: 0,
      }),
    ).toBeNull();
  });

  it("exige une note en bande de vigilance haute", () => {
    expect(
      reviewTransitionError({
        from: "en_revue",
        to: "conclu",
        outcome: "vigilance_standard",
        highBand: true,
        noteLength: 0,
      }),
    ).toMatch(/note de justification/i);
  });

  it("exige une note pour toute ESCALADE, même hors bande haute", () => {
    expect(
      reviewTransitionError({
        from: "en_revue",
        to: "conclu",
        outcome: "vigilance_renforcee",
        highBand: false,
        noteLength: 0,
      }),
    ).toMatch(/note de justification/i);
    // …mais une note suffisante débloque.
    expect(
      reviewTransitionError({
        from: "en_revue",
        to: "conclu",
        outcome: "vigilance_renforcee",
        highBand: false,
        noteLength: 20,
      }),
    ).toBeNull();
  });

  it("n'exige jamais de note pour ouvrir ou rouvrir la revue", () => {
    expect(
      reviewTransitionError({
        from: "a_trier",
        to: "en_revue",
        highBand: true,
        noteLength: 0,
      }),
    ).toBeNull();
  });
});
