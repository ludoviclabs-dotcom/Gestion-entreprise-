import { useEffect, useState } from "react";
import { CheckCircle2, EyeOff, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { FinancialEvent, Scenario } from "@/lib/learning/schema";
import {
  LAYER_LABELS,
  feeLegs,
  frDate,
  legAmount,
  objectLabel,
  type ScenarioState,
} from "@/lib/learning/projections";
import { useReducedMotion } from "@/components/landing/useReducedMotion";
import type { Selection } from "./ScenarioGraph";

const SPEEDS = { lente: 3200, normale: 2000, rapide: 1100 } as const;
type Speed = keyof typeof SPEEDS;

const LAYER_STYLES: Record<FinancialEvent["layer"], string> = {
  fiat: "border-sky-500/50 text-sky-800 dark:text-sky-300",
  interne: "border-dashed border-muted-foreground/60 text-muted-foreground",
  chaine: "border-orange-500/60 text-orange-800 dark:text-orange-300",
};

function HopLegs({ scenario, event }: { scenario: Scenario; event: FinancialEvent }) {
  const fees = feeLegs(event);
  const given = event.legs.filter((l) => l.role === "conversion_entree");
  const received = event.legs.filter((l) => l.role === "conversion_sortie");
  const sent = event.legs.filter((l) => l.role === "envoi");
  return (
    <ul className="mt-1.5 space-y-0.5 text-sm">
      {sent.map((l, i) => (
        <li key={`s${i}`}>
          {objectLabel(scenario, l.from)} → {l.to ? objectLabel(scenario, l.to) : "?"} :{" "}
          <span className="font-semibold tabular-nums">{legAmount(l)}</span>
        </li>
      ))}
      {given.map((l, i) => (
        <li key={`g${i}`}>
          Remis : <span className="font-semibold tabular-nums">{legAmount(l)}</span>
        </li>
      ))}
      {received.map((l, i) => (
        <li key={`r${i}`}>
          Reçu : <span className="font-semibold tabular-nums">{legAmount(l)}</span>
        </li>
      ))}
      {fees.length ? (
        <li className="text-xs text-muted-foreground">
          Frais : {fees.map(legAmount).join(" ; ")}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * Parcours animé (cadrage §4.6, §9.2) : l'animation démarre sur commande, se
 * met en pause, avance pas à pas et s'arrête à la frontière de connaissance.
 * Avec « mouvement réduit », rien ne bouge : la lecture passe d'étape en étape.
 */
export function FlowView({
  scenario,
  state,
  selection,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const hops = state.events;
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normale");
  const [perspective, setPerspective] = useState<string>("tous");
  const end = hops.length;
  const at = Math.min(current, end);
  const duration = SPEEDS[speed];

  const advance = () => {
    if (at >= end - 1) {
      setCurrent(end);
      setPlaying(false);
    } else setCurrent(at + 1);
  };

  // Mouvement réduit : la lecture avance par minuterie, sans déplacement à l'écran.
  useEffect(() => {
    if (!playing || !reduced) return;
    const t = setTimeout(advance, duration);
    return () => clearTimeout(t);
  });

  if (hops.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune opération n'est documentée à cette étape.</p>;
  }

  const observer = scenario.observers.find((o) => o.id === perspective);
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (at >= end) setCurrent(0);
    setPlaying(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setCurrent(Math.max(0, at - 1));
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
          aria-label="Opération précédente"
        >
          <SkipBack size={13} aria-hidden /> Précédent
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex items-center gap-1 rounded-md bg-violet px-3 py-1.5 text-xs font-semibold text-[#04201d]"
        >
          {playing ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}
          {playing ? "Pause" : at >= end ? "Rejouer" : "Lecture"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setCurrent(Math.min(end, at + 1));
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
          aria-label="Opération suivante"
        >
          Suivant <SkipForward size={13} aria-hidden />
        </button>
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Vitesse
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as Speed)}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground"
          >
            <option value="lente">Lente</option>
            <option value="normale">Normale</option>
            <option value="rapide">Rapide</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Perspective
          <select
            value={perspective}
            onChange={(e) => setPerspective(e.target.value)}
            className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground"
          >
            <option value="tous">Toutes les pièces du dossier</option>
            {scenario.observers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Chaque montant reste dans son unité. Un équivalent en euros exigerait une date, une méthode et une source de taux.
        {observer ? ` Perspective simulée : ${observer.label}. ${observer.limit}` : ""}
      </p>

      <ol className="space-y-2" aria-label="Opérations du paiement" aria-live="polite">
        {hops.map((ev, i) => {
          const isCurrent = i === at;
          const hidden = observer ? !ev.visibleTo.includes(observer.id) : false;
          const selected = selection?.type === "event" && selection.id === ev.id;
          return (
            <li
              key={ev.id}
              aria-current={isCurrent ? "step" : undefined}
              className={`rounded-md border p-3 transition-opacity ${
                isCurrent ? "border-orange-500/70 bg-orange-500/5" : "border-border"
              } ${hidden ? "opacity-45" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="text-xs text-muted-foreground">{frDate(ev.occurredOn)}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[11px] ${LAYER_STYLES[ev.layer]}`}>
                  {LAYER_LABELS[ev.layer]}
                </span>
                {hidden ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <EyeOff size={12} aria-hidden /> Invisible pour {observer?.label}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect({ type: "event", id: ev.id })}
                className="mt-1 text-left text-sm font-semibold underline decoration-border underline-offset-2 hover:decoration-violet"
              >
                {ev.label}
              </button>
              <HopLegs scenario={scenario} event={ev} />
              {isCurrent && playing && !reduced ? (
                <div className="flow-track mt-2" aria-hidden>
                  <span
                    key={`${ev.id}-${speed}`}
                    className="flow-dot"
                    style={{ animationDuration: `${duration}ms` }}
                    onAnimationEnd={advance}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
        <li
          aria-current={at >= end ? "step" : undefined}
          className={`rounded-md border p-3 ${
            at >= end ? "border-teal bg-teal/5" : "border-dashed border-border"
          }`}
        >
          {state.boundary ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <EyeOff size={15} aria-hidden /> Frontière de connaissance
              </p>
              <p className="mt-1 text-sm leading-6">{state.boundary}</p>
              <p className="mt-1 text-xs text-muted-foreground">L'animation s'arrête ici : ce qui n'est pas documenté reste inconnu.</p>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 size={15} aria-hidden /> Parcours documenté jusqu'au bénéficiaire.
            </p>
          )}
        </li>
      </ol>
    </div>
  );
}
