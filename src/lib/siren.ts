/** Utilitaires SIREN / SIRET — validation Luhn, sans dépendance. */

export function normalizeSiren(input: string): string {
  return input.replace(/\D/g, "");
}

/** Algorithme de Luhn (clé de contrôle SIREN/SIRET). */
export function isValidLuhn(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let sum = 0;
  let double = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = num.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** SIREN = 9 chiffres + Luhn valide. */
export function isValidSiren(input: string): boolean {
  const s = normalizeSiren(input);
  return s.length === 9 && isValidLuhn(s);
}

/** SIRET = 14 chiffres + Luhn valide. */
export function isValidSiret(input: string): boolean {
  const s = normalizeSiren(input);
  return s.length === 14 && isValidLuhn(s);
}
