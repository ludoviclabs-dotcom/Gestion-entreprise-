"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Newspaper } from "lucide-react";
import { PRESS_STALE_MS } from "@/lib/data/press-status";

/** Rafraîchissement rapide pendant la première minute (la presse arrive en ≈ 15 s). */
const FAST_POLL_MS = 5_000;
const FAST_WINDOW_MS = 60_000;
/** Puis lent, jusqu'à ce que le serveur déclare la collecte interrompue. */
const SLOW_POLL_MS = 30_000;
/** Marge après l'échéance : l'horloge du navigateur peut différer de celle du serveur. */
const DEADLINE_GRACE_MS = 60_000;

/**
 * Bandeau « presse » d'un dossier dont la collecte GDELT n'est pas terminée.
 *
 *  - `pending` : la presse est en cours de collecte (source pas encore
 *    interrogée) ; la page se rafraîchit seule jusqu'à l'arrivée du résultat,
 *    puis jusqu'à l'échéance au-delà de laquelle le serveur la déclare
 *    interrompue — le bandeau ne reste donc jamais « en cours » indéfiniment.
 *  - `interrupted` : la collecte n'a pas abouti. La presse n'a PAS été consultée :
 *    ce n'est pas « aucun article », et la vigilance n'en tient pas compte.
 */
export default function PressNotice({
  state,
  requestedAt,
}: {
  state: "pending" | "interrupted";
  /** Horodatage serveur de la demande de collecte (ISO 8601). */
  requestedAt?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (state !== "pending") return;
    const mountedAt = Date.now();
    const requested = requestedAt ? Date.parse(requestedAt) : NaN;
    // Échéance côté serveur ; à défaut d'horodatage lisible, borne depuis le montage.
    const staleAt = (Number.isFinite(requested) ? requested : mountedAt) + PRESS_STALE_MS;
    const stopAt = staleAt + DEADLINE_GRACE_MS;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = Date.now();
      if (now >= stopAt) return;
      const base = now - mountedAt < FAST_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
      // Un rafraîchissement tombe pile à l'échéance : le bandeau bascule alors
      // sans attendre le prochain tick lent.
      const untilStale = staleAt + 1_000 - now;
      const delay = untilStale > 0 ? Math.min(base, untilStale) : base;
      timer = setTimeout(() => {
        router.refresh();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [state, requestedAt, router]);

  return (
    <div
      role="status"
      data-testid="press-notice"
      className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground"
    >
      <Newspaper size={14} className="mt-0.5 shrink-0" aria-hidden />
      {state === "pending" ? (
        <p>
          <span className="font-medium text-foreground">
            Presse en cours de collecte.
          </span>{" "}
          Les autres sources sont déjà consultées. Les articles, le score de
          vigilance et la qualité de preuve seront mis à jour dès la réponse de
          GDELT (une dizaine de secondes).
        </p>
      ) : (
        <p>
          <span className="font-medium text-foreground">
            Presse non consultée pour ce dossier.
          </span>{" "}
          La collecte n&apos;a pas abouti : ce n&apos;est pas « aucun article »,
          et la vigilance n&apos;en tient pas compte. Recréer le dossier relance
          la consultation.
        </p>
      )}
    </div>
  );
}
