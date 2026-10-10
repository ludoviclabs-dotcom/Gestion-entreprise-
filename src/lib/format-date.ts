/**
 * Formatage de dates DÉTERMINISTE : le résultat ne dépend ni du fuseau du
 * serveur (UTC sur Vercel) ni de celui du navigateur.
 *
 * Pourquoi : `new Date(x).toLocaleDateString("fr-FR")` utilise le fuseau du lieu
 * d'exécution. Dans un composant client rendu côté serveur puis hydraté, le HTML
 * (UTC) et le navigateur (Paris) divergent entre 22 h et minuit UTC — React lève
 * alors l'erreur d'hydratation #418 et la page se re-rend côté client.
 *
 * Deux natures de dates :
 *  - un INSTANT (« 2026-10-10T22:30:00Z ») → affiché à l'heure de Paris ;
 *  - une date de CALENDRIER (« 2026-09-24 », sans heure) → affichée telle quelle,
 *    sans décalage de fuseau (elle n'est la date d'aucun instant précis).
 */
const PARIS = "Europe/Paris";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Input = string | number | Date | null | undefined;

function toDate(input: Input): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS,
  dateStyle: "medium",
  timeStyle: "short",
});

/** « 10/10/2026 » — instant (heure de Paris) ou date de calendrier (sans décalage). */
export function formatDateFr(
  input: Input,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(input);
  if (!d) return typeof input === "string" && input ? input : "—";
  if (typeof input === "string" && CALENDAR_DATE.test(input)) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...options,
      timeZone: "UTC",
    }).format(d);
  }
  if (options) {
    return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: PARIS }).format(d);
  }
  return dayFormatter.format(d);
}

/** « 10 oct. 2026, 14:03 » — instant, heure de Paris. */
export function formatDateTimeFr(input: Input): string {
  const d = toDate(input);
  if (!d) return typeof input === "string" && input ? input : "—";
  return dateTimeFormatter.format(d);
}

const relativeFormatter = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/**
 * « il y a 3 heures », « hier », « il y a 4 jours » — relatif à `now`, FOURNI
 * par l'appelant (résultat déterministe, testable). Au-delà de 7 jours, ou pour
 * un instant futur, on revient à la date absolue (« 02/10/2026 »).
 */
export function formatRelativeFr(input: Input, now: Date): string {
  const d = toDate(input);
  if (!d) return typeof input === "string" && input ? input : "—";
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  if (seconds > 60) return formatDateFr(d);
  const ago = -seconds;
  if (ago < 60) return "à l'instant";
  if (ago < 3600) return relativeFormatter.format(-Math.floor(ago / 60), "minute");
  if (ago < 86400) return relativeFormatter.format(-Math.floor(ago / 3600), "hour");
  if (ago < 7 * 86400) return relativeFormatter.format(-Math.floor(ago / 86400), "day");
  return formatDateFr(d);
}
