import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section ancrée de la page de prévisualisation du design system. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 border-t border-border py-10 first:border-t-0 first:pt-0"
    >
      <h2 id={`${id}-title`} className="font-display text-xl font-semibold">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  );
}

/** Un spécimen légendé (légende en capitales + contenu). */
export function Specimen({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div>
      <p className="text-eyebrow mb-2">{label}</p>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}
