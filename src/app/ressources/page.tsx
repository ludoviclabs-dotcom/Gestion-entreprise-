import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { RegulatoryAnchor } from "@/components/site/RegulatoryAnchor";
import { RESOURCE_GROUPS } from "@/lib/domain/resources";

export const metadata = {
  title: "Ressources réglementaires — KYB Graph",
  description:
    "Ancrages réglementaires datés et liés : paquet AML UE (AMLR/AMLD6/AMLA), Code monétaire et financier, FATF/GAFI, souveraineté ANSSI, jurisprudence CJUE et RGPD.",
};

export default function RessourcesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SitePageHeader
        eyebrow="Ressources"
        title="Ancrages réglementaires"
        intro="Les textes officiels qui fondent la méthode KYB Graph — datés et liés à leur source (EUR-Lex, Légifrance, ANSSI, FATF, curia)."
      />

      <section className="px-6 pb-16 pt-8">
        <div className="mx-auto grid max-w-6xl gap-10">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.category}>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                {group.category}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                {group.intro}
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {group.refs.map((ref) => (
                  <RegulatoryAnchor key={ref.label} source={ref} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
