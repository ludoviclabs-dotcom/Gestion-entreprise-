import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import {
  PUBLIC_FAMILIES,
  SOURCE_STATE_LABEL,
  publicSourceCounts,
  sourcesIntro,
  sourcesOfFamily,
  type PublicSourceState,
} from "@/lib/domain/public-sources";

export const metadata = {
  title: "Sources — KYB Graph",
  description:
    "Les sources publiques et officielles de KYB Graph : ce qui est actif, ce qui est en cours de mise en service, et comment chacune est interrogée.",
};

const STATE_STYLE: Record<PublicSourceState, string> = {
  actif: "border-emerald/40 text-emerald",
  partiel: "border-amber/40 text-amber",
  en_cours: "border-border text-muted-foreground",
};

export default function SourcesPage() {
  const counts = publicSourceCounts();
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <SitePageHeader
          eyebrow="Sources"
          title="Sources publiques et officielles"
          intro={sourcesIntro(counts)}
        />

        <section className="px-6 pt-8">
          <div className="mx-auto max-w-6xl rounded-lg border border-border bg-surface p-4 text-sm leading-7 text-muted-foreground">
            <p>
              <strong className="text-foreground">Actif</strong> : source validée sur des dossiers
              réels. <strong className="text-foreground">Disponibilité partielle</strong> : source
              active dont le fournisseur limite le débit. <strong className="text-foreground">En cours</strong>{" "}
              : objectif affiché, mise en service non terminée — son absence d&apos;un dossier ne
              signifie rien. Une source consultée sans résultat n&apos;est jamais présentée comme
              une preuve d&apos;absence.
            </p>
          </div>
        </section>

        {PUBLIC_FAMILIES.map((family) => (
          <section key={family.id} className="px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                {family.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{family.text}</p>
              <div className="mt-5 overflow-hidden rounded-lg border border-border">
                {sourcesOfFamily(family.id).map((s, i) => (
                  <div
                    key={s.key}
                    className={`grid gap-2 p-4 md:grid-cols-[1fr_1.6fr_auto] md:items-center md:gap-6 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="mt-1 text-xs text-violet">{s.access}</p>
                    </div>
                    <div>
                      <p className="text-sm leading-6 text-muted-foreground">{s.text}</p>
                      {s.note ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.note}</p>
                      ) : null}
                    </div>
                    <span
                      className={`justify-self-start rounded-md border px-2 py-1 text-xs font-medium md:justify-self-end ${STATE_STYLE[s.state]}`}
                    >
                      {SOURCE_STATE_LABEL[s.state]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
      <PublicFooter />
    </>
  );
}
