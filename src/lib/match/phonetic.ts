/**
 * Clé phonétique (variante Soundex francisée) — pur TS, zéro dépendance.
 *
 * Usage : BLOCKING uniquement (regrouper des candidats potentiels avant le
 * calcul de similarité). Ne décide JAMAIS d'une fusion à elle seule.
 */
import { normalizeName } from "@/lib/match/normalize";

const CODES: Record<string, string> = {
  b: "1", p: "1", f: "1", v: "1",
  c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
  d: "3", t: "3",
  l: "4",
  m: "5", n: "5",
  r: "6",
};

const codeOf = (ch: string): string => CODES[ch] ?? "0";

/** Soundex francisé d'un token (4 caractères : initiale + 3 chiffres). */
function soundexFr(token: string): string {
  const pre = token
    .replace(/ph/g, "f")
    .replace(/gu/g, "g")
    .replace(/qu/g, "k")
    .replace(/ch/g, "x")
    .replace(/[hw]/g, "");
  if (!pre) return "";

  let out = pre[0].toUpperCase();
  let prev = codeOf(pre[0]);
  for (let i = 1; i < pre.length && out.length < 4; i += 1) {
    const c = codeOf(pre[i]);
    if (c !== "0" && c !== prev) out += c;
    prev = c;
  }
  return (out + "000").slice(0, 4);
}

/** Clé phonétique d'un nom complet (codes des tokens joints par « - »). */
export function phoneticKey(input: string): string {
  return normalizeName(input)
    .split(" ")
    .filter(Boolean)
    .map(soundexFr)
    .filter(Boolean)
    .join("-");
}
