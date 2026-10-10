import { describe, it, expect } from "vitest";
import { formatDuration, sortedTimings, timingsOf } from "@/lib/data/timings";

describe("timingsOf", () => {
  it("lit les durées persistées et arrondit", () => {
    expect(timingsOf({ timings: { gdelt: 10812.6, bodacc: 412, _total: 11300 } })).toEqual({
      gdelt: 10813,
      bodacc: 412,
      _total: 11300,
    });
  });

  it("ignore tout ce qui n'est pas une durée valide, sans lever", () => {
    expect(timingsOf({ timings: { a: "12", b: -1, c: NaN, d: Infinity, e: 5 } })).toEqual({ e: 5 });
    for (const bad of [null, undefined, {}, "x", { timings: null }, { timings: [1, 2] }, { timings: {} }]) {
      expect(timingsOf(bad)).toBeUndefined();
    }
  });
});

describe("formatDuration / sortedTimings", () => {
  it("virgule française", () => {
    expect(formatDuration(412)).toBe("0,4 s");
    expect(formatDuration(12_340)).toBe("12,3 s");
  });

  it("trie de la plus lente à la plus rapide, hors total", () => {
    expect(sortedTimings({ bodacc: 400, gdelt: 10_000, _total: 10_500, vies: 900 })).toEqual([
      ["gdelt", 10_000],
      ["vies", 900],
      ["bodacc", 400],
    ]);
  });
});
