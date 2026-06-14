import { notFound } from "next/navigation";
import { Network, Users, GitBranch, Activity, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import KpiCard from "@/components/cases/KpiCard";
import EmptyState from "@/components/empty/EmptyState";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeGraphMetrics } from "@/lib/graph/algorithms";
import { explainComplexite } from "@/lib/risk/engine";
import { NODE_COLORS, NODE_LABELS } from "@/lib/graph/graph-types";
import { AlgorithmExplainer } from "@/components/cases/AlgorithmExplainer";
import ComplexiteBreakdown from "@/components/cases/ComplexiteBreakdown";

export default async function AnalyseTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();
  const { bundle } = detail;

  // Calcul des métriques côté serveur (Graphology pur, sans Sigma).
  const graph = buildGraph(bundle);
  const metrics = computeGraphMetrics(graph);

  // Trop peu de données → empty state.
  if (bundle.entities.length < 2) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Analyse structurelle
        </h2>
        <div className="mt-6">
          <EmptyState
            icon={BarChart3}
            title="Analyse non significative"
            description="Le dossier ne contient pas assez d'entités pour produire des métriques structurelles. Lance un enrichissement pour étendre le graphe."
          />
        </div>
      </div>
    );
  }

  // Top 5 pivots (betweenness > 0).
  const topPivots = Object.entries(metrics.betweenness)
    .filter(([id, score]) => score > 0 && bundle.entities.some((e) => e.id === id))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, score]) => ({
      id,
      score,
      entity: bundle.entities.find((e) => e.id === id),
    }));

  // Communautés Louvain : agrège par identifiant + taille + libellé représentatif.
  const communityGroups = new Map<number, string[]>();
  for (const [nodeId, communityId] of Object.entries(metrics.communities)) {
    const list = communityGroups.get(communityId) ?? [];
    list.push(nodeId);
    communityGroups.set(communityId, list);
  }
  const communities = Array.from(communityGroups.entries())
    .map(([id, nodes]) => ({
      id,
      size: nodes.length,
      labels: nodes
        .slice(0, 3)
        .map((n) => bundle.entities.find((e) => e.id === n)?.label ?? n),
    }))
    .filter((c) => c.size >= 2)
    .sort((a, b) => b.size - a.size);

  // Degrés moyen et max.
  const degrees = bundle.entities.map((e) =>
    graph.hasNode(e.id) ? graph.degree(e.id) : 0,
  );
  const avgDegree = degrees.length
    ? Math.round(
        (degrees.reduce((a, b) => a + b, 0) / degrees.length) * 100,
      ) / 100
    : 0;
  const maxDegree = Math.max(0, ...degrees);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Analyse structurelle
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Métriques calculées par Graphology : centralité d&apos;intermédiarité,
          communautés (Louvain), cycles de détention (composantes fortement
          connexes).
        </p>
      </div>

      <div className="mt-6">
        <ComplexiteBreakdown
          explanation={explainComplexite(bundle, graph)}
          id="complexite"
        />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Communautés"
          value={communities.length}
          icon={Users}
          hint="Sous-groupes Louvain ≥ 2 entités"
        />
        <KpiCard
          label="Cycles de détention"
          value={metrics.cycles.length}
          icon={GitBranch}
          accent={metrics.cycles.length > 0 ? "var(--red)" : "var(--emerald)"}
          hint={metrics.cycles.length > 0 ? "À vérifier" : "Aucun détecté"}
        />
        <KpiCard
          label="Degré max"
          value={maxDegree}
          icon={Network}
          hint={`Moyenne : ${avgDegree}`}
        />
        <KpiCard
          label="Pivot principal"
          value={
            metrics.topPivot
              ? `${Math.round(metrics.topPivot.score * 100)}%`
              : "—"
          }
          icon={Activity}
          accent="var(--violet)"
          hint={
            metrics.topPivot
              ? (bundle.entities.find((e) => e.id === metrics.topPivot!.id)
                  ?.label ?? "—")
              : "Centralité d'intermédiarité"
          }
        />
      </div>

      {/* Top pivots */}
      <div className="mt-8">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
          Top pivots
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Entités qui relient le plus grand nombre de sous-réseaux — à examiner
          en priorité (nominees, dirigeants-paille, sociétés-relais).
        </p>
        <AlgorithmExplainer id="centralite" />
        {topPivots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Pas de pivot significatif sur ce dossier.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {topPivots.map(({ id, score, entity }) => (
              <Card
                key={id}
                className="flex-row items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  {entity && (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: NODE_COLORS[entity.type] }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {entity?.label ?? id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entity ? NODE_LABELS[entity.type] : "—"}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm text-primary">
                  {Math.round(score * 1000) / 10}%
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Communautés */}
      <div className="mt-8">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
          Communautés détectées
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Modularité Louvain : sous-graphes denses, candidats à une analyse
          groupée.
        </p>
        {communities.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune communauté ≥ 2 entités.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {communities.map((c, idx) => (
              <Card key={c.id} className="p-3">
                <p className="text-xs text-muted-foreground">
                  Communauté #{idx + 1} · {c.size} entités
                </p>
                <p className="mt-1 text-sm">
                  {c.labels.join(", ")}
                  {c.size > 3 ? "…" : ""}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cycles */}
      {metrics.cycles.length > 0 && (
        <div className="mt-8">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
            Cycles de détention
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Composantes fortement connexes du sous-graphe `DETIENT`. Structure
            circulaire — rarement innocente, à déclarer sous AMLR.
          </p>
          <AlgorithmExplainer id="boucles" />
          <div className="mt-3 space-y-2">
            {metrics.cycles.map((cycle, i) => (
              <Card key={`cycle-${i}`} className="p-3">
                <p className="text-xs text-muted-foreground">
                  Cycle #{i + 1} · {cycle.length} sociétés
                </p>
                <p className="mt-1 text-sm">
                  {cycle
                    .map(
                      (id) =>
                        bundle.entities.find((e) => e.id === id)?.label ?? id,
                    )
                    .join(" → ")}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
