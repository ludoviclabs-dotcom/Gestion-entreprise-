"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Newspaper } from "lucide-react";

/** Rafraîchit la page toutes les 5 s, au plus 12 fois (≈ 1 min). */
const POLL_MS = 5_000;
const POLL_MAX = 12;

/**
 * Bandeau « presse » d'un dossier dont la collecte GDELT n'est pas terminée.
 *
 *  - `pending` : la presse est en cours de collecte (source pas encore
 *    interrogée) ; la page se rafraîchit seule jusqu'à l'arrivée du résultat.
 *  - `interrupted` : la collecte n'a pas abouti. La presse n'a PAS été consultée :
 *    ce n'est pas « aucun article », et la vigilance n'en tient pas compte.
 */
export default function PressNotice({
  state,
}: {
  state: "pending" | "interrupted";
}) {
  const router = useRouter();

  useEffect(() => {
    if (state !== "pending") return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= POLL_MAX) clearInterval(timer);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, router]);

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
