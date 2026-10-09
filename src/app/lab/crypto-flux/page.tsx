import { PublicFooter } from "@/components/site/PublicFooter";
import { LearningPathIntro } from "@/components/learning/LearningPathIntro";
import { CRYPTO_FLUX } from "@/lib/learning/paths";

export const metadata = {
  title: "Cryptoactifs et circulation des fonds — Lab KYB Graph",
  description:
    "Parcours guidé et fictif : suivre un paiement de la banque à la chaîne, repérer les frontières de connaissance et choisir les vérifications utiles.",
};

export default function CryptoFluxPage() {
  return (
    <>
      <LearningPathIntro path={CRYPTO_FLUX} />
      <PublicFooter />
    </>
  );
}
