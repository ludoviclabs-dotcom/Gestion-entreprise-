import { env, isDemoMode, isTresorGelsEnabled } from "@/lib/env";
import { fetchJson } from "./http";
import gelsFixture from "@/lib/fixtures/tresor-gels.sample.json";
import type { ConnectorResult } from "./types";

// API publique sans auth, mais MOCK par défaut (TRESOR_GELS_ENABLED=false).
export const tresorGels = {
  async match(params: {
    siren?: string;
    name?: string;
  }): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isTresorGelsEnabled()) {
      return {
        raw: gelsFixture,
        endpoint: "fixture:tresor-gels",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const endpoint = `${env.TRESOR_GELS_BASE_URL}/publication/derniere-publication-flux-json`;
    const { data, status } = await fetchJson(endpoint, {});
    // Le rapprochement nom/SIREN réel sera fait en mémoire (fast-follow).
    return {
      raw: { publication: data, query: params },
      endpoint,
      httpStatus: status,
      isFixture: false,
    };
  },
};
