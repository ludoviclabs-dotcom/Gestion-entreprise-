import inpiFixture from "@/lib/fixtures/inpi-rne.sample.json";
import type { ConnectorResult } from "./types";

// STUB MVP1 : l'API RNE/INPI exige une authentification (login → token).
// Hors périmètre du MVP1 : on renvoie toujours la fixture (dirigeants déclarés).
export const inpi = {
  async getRne(siren: string): Promise<ConnectorResult<unknown>> {
    return {
      raw: inpiFixture,
      endpoint: `fixture:inpi-rne:${siren}`,
      httpStatus: 0,
      isFixture: true,
    };
  },
};
