import Link from "next/link";
import { ArrowRight, CircleCheck, FilePlus2, Target } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TONE_STYLES } from "@/lib/design/tone";
import type { NextAction } from "@/lib/dashboard/portfolio";
import { cn } from "@/lib/utils";

const ICON = { review: Target, clear: CircleCheck, create_first: FilePlus2 } as const;

/**
 * « Prochaine action » : UNE phrase, UN bouton. Répond à « que faire
 * maintenant ? » sans lecture du reste de la page. Liseré gauche à la teinte de
 * la raison principale ; la raison est toujours écrite en toutes lettres.
 */
export default function NextActionBanner({ action }: { action: NextAction }) {
  const Icon = ICON[action.kind];
  const styles = TONE_STYLES[action.tone];
  return (
    <section
      aria-labelledby="next-action-title"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-l-2 border-border bg-surface-2 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        styles.edge,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
            styles.soft,
          )}
        >
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-eyebrow">Prochaine action</p>
          <h2 id="next-action-title" className="mt-0.5 font-display text-base font-semibold text-foreground">
            {action.title}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{action.description}</p>
        </div>
      </div>
      <Link
        href={action.href}
        className={cn(buttonVariants({ size: "sm" }), "shrink-0 self-start sm:self-center")}
      >
        {action.cta}
        <ArrowRight aria-hidden />
      </Link>
    </section>
  );
}
