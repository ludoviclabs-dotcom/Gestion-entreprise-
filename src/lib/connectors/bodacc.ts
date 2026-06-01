import { env, isDemoMode } from "@/lib/env";
import { fetchJson } from "./http";
import bodaccFixture from "@/lib/fixtures/bodacc.sample.json";
import type { ConnectorResult } from "./types";

// BODACC = open data sans clé. Mode démo → fixture ; sinon API réelle (repli fixture si échec).
export const bodacc = {
  async bySiren(siren: string, limit = 100): Promise<ConnectorResult<unknown>> {
    if (isDemoMode()) {
      return {
        raw: bodaccFixture,
        endpoint: "fixture:bodacc",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const where = encodeURIComponent(`registre:"${siren}"`);
    const order = encodeURIComponent("dateparution DESC");
    let endpoint = `${env.BODACC_BASE_URL}/catalog/datasets/annonces-commerciales/records?where=${where}&order_by=${order}&limit=${limit}`;
    if (env.BODACC_API_KEY) endpoint += `&apikey=${env.BODACC_API_KEY}`;
    try {
      const { data, status } = await fetchJson(endpoint, {});
      return { raw: data, endpoint, httpStatus: status, isFixture: false };
    } catch {
      return {
        raw: bodaccFixture,
        endpoint: "fixture:bodacc(repli)",
        httpStatus: 0,
        isFixture: true,
      };
    }
  },
};
