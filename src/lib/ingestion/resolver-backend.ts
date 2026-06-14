import { env } from "@/lib/env";
import {
  resolveEntities,
  type ResolveInput,
  type ResolveResult,
} from "./entity-resolver";

/**
 * Seam de résolution d'entités — même patron que GraphQueryRepository /
 * AgeCypherRepository (`src/lib/data/graph-query-repository.ts`). Le backend
 * `builtin` (TS in-process) est le défaut ; `splink` est un stub prêt à être
 * raccordé à un sidecar Python via le patron connecteur `fetchJson`.
 */
export interface EntityResolverBackend {
  resolve(input: ResolveInput): Promise<ResolveResult>;
}

class BuiltinResolver implements EntityResolverBackend {
  async resolve(input: ResolveInput): Promise<ResolveResult> {
    return resolveEntities(input);
  }
}

class SplinkResolver implements EntityResolverBackend {
  async resolve(): Promise<ResolveResult> {
    // Cible : POST ${SPLINK_BASE_URL}/resolve (record linkage probabiliste).
    throw new Error(
      "SplinkResolver non raccordé : démarrer le sidecar Splink (SPLINK_BASE_URL) et implémenter l'appel /resolve.",
    );
  }
}

let _resolver: EntityResolverBackend | null = null;

export function getEntityResolver(): EntityResolverBackend {
  if (_resolver) return _resolver;
  _resolver =
    env.RESOLVER_BACKEND === "splink"
      ? new SplinkResolver()
      : new BuiltinResolver();
  return _resolver;
}
