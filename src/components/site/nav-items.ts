/** Source unique des liens de navigation publique (nav + footer). */
export type NavItem = { label: string; href: string };

export const PUBLIC_NAV: NavItem[] = [
  { label: "Secteurs", href: "/secteurs" },
  { label: "Souveraineté", href: "/souverainete" },
  { label: "Sécurité", href: "/securite" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Ressources", href: "/ressources" },
  { label: "Démo", href: "/demo" },
];
