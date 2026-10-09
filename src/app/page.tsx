import DayLanding from "@/components/landing/kyb/DayLanding";
import NightLanding from "@/components/landing/kyb/NightLanding";
import { DirectionSwitch, LandingProvider } from "@/components/landing/kyb/LandingState.client";
import { landingFontVars } from "@/components/landing/kyb/fonts";
import "@/components/landing/kyb/landing.css";

/**
 * Landing KYB Graph — deux directions, une par thème :
 * mode jour → 1a « Registre », mode nuit → 1b « Nuit ».
 * Les deux arbres sont rendus ; la classe next-themes de <html> affiche le bon
 * avant le premier paint. Le sélecteur en bas de page bascule le thème.
 */
export default function Home() {
  return (
    <div className={`kgl-root ${landingFontVars}`}>
      <LandingProvider>
        <DayLanding />
        <NightLanding />
        <DirectionSwitch />
      </LandingProvider>
    </div>
  );
}
