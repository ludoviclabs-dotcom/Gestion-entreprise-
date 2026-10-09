import { PublicFooter } from "@/components/site/PublicFooter";
import { LearningPathIntro } from "@/components/learning/LearningPathIntro";
import { CONTROLE_ACTIFS } from "@/lib/learning/paths";

export const metadata = {
  title: "Contrôle et actifs stratégiques — Lab KYB Graph",
  description:
    "Parcours guidé et fictif : lire capital, droits de vote, dépendances et accès autour d'une entreprise industrielle, sans transformer une relation en menace.",
};

export default function ControleActifsPage() {
  return (
    <>
      <LearningPathIntro path={CONTROLE_ACTIFS} />
      <PublicFooter />
    </>
  );
}
