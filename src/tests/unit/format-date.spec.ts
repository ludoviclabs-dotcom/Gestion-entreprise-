import { describe, it, expect, afterEach } from "vitest";
import { formatDateFr, formatDateTimeFr } from "@/lib/format-date";

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

/**
 * Régression React #418 : le serveur (UTC) et le navigateur (Paris) ne doivent
 * jamais produire deux textes différents pour la même date.
 */
describe("formatDateFr / formatDateTimeFr", () => {
  it("un instant est affiché à l'heure de Paris (jour suivant après 22 h UTC en été)", () => {
    expect(formatDateFr("2026-10-10T21:59:00Z")).toBe("10/10/2026");
    expect(formatDateFr("2026-10-10T22:30:00Z")).toBe("11/10/2026"); // minuit 30 à Paris (UTC+2)
    expect(formatDateFr("2026-01-10T23:30:00Z")).toBe("11/01/2026"); // hiver : UTC+1
  });

  it("une date de calendrier n'est jamais décalée par un fuseau", () => {
    expect(formatDateFr("2026-01-01")).toBe("01/01/2026");
    expect(formatDateFr("2026-09-24", { day: "2-digit", month: "long", year: "numeric" })).toBe(
      "24 septembre 2026",
    );
  });

  it("résultat identique quel que soit le fuseau du processus (serveur vs navigateur)", () => {
    const sample = ["2026-10-10T22:30:00Z", "2026-01-01", "2026-03-29T00:30:00Z"];
    const reference = sample.map((s) => formatDateFr(s));
    const referenceTime = formatDateTimeFr("2026-10-10T22:30:00Z");
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Paris"]) {
      process.env.TZ = tz;
      expect(sample.map((s) => formatDateFr(s))).toEqual(reference);
      expect(formatDateTimeFr("2026-10-10T22:30:00Z")).toBe(referenceTime);
    }
  });

  it("date et heure : heure de Paris", () => {
    expect(formatDateTimeFr("2026-10-10T12:03:00Z")).toMatch(/10 oct\. 2026.*14:03/);
  });

  it("valeur absente ou invalide : jamais d'exception ni « Invalid Date »", () => {
    expect(formatDateFr(undefined)).toBe("—");
    expect(formatDateFr(null)).toBe("—");
    expect(formatDateFr("")).toBe("—");
    expect(formatDateFr("n'importe quoi")).toBe("n'importe quoi");
    expect(formatDateTimeFr("n'importe quoi")).toBe("n'importe quoi");
    expect(formatDateFr("n'importe quoi")).not.toMatch(/Invalid/);
  });
});
