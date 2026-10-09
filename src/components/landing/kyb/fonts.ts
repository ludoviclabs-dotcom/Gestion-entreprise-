import { Geist_Mono, Instrument_Sans, JetBrains_Mono, Public_Sans } from "next/font/google";

/** 1a « Registre » (jour) : grotesque précise + mono technique. */
export const instrumentSans = Instrument_Sans({ variable: "--font-kg-instrument", subsets: ["latin"] });
export const jetbrainsMono = JetBrains_Mono({ variable: "--font-kg-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

/** 1b « Nuit » : Public Sans + Geist Mono. */
export const publicSans = Public_Sans({ variable: "--font-kg-public", subsets: ["latin"] });
export const geistMono = Geist_Mono({ variable: "--font-kg-geist-mono", subsets: ["latin"], weight: ["400", "500"] });

export const landingFontVars = [instrumentSans, jetbrainsMono, publicSans, geistMono].map((f) => f.variable).join(" ");
