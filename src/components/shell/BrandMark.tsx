import { cn } from "@/lib/utils";

/**
 * Marque KYB Graph : anneau + point d'accent — celle de l'accueil
 * (landing.css `.a-brand-mark` / `.b-brand-mark`). Purement décorative : le nom
 * « KYB Graph » est toujours rendu à côté en texte.
 */
export default function BrandMark({
  size = 18,
  className,
}: {
  /** Diamètre extérieur en px. */
  size?: number;
  className?: string;
}) {
  const dot = Math.max(4, Math.round(size / 3));
  return (
    <span
      aria-hidden
      data-slot="brand-mark"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full border-[1.5px] border-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="rounded-full bg-primary"
        style={{ width: dot, height: dot }}
      />
    </span>
  );
}
