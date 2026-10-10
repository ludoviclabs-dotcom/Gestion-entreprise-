import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Champ de saisie. La frontière utilise `border-control` (≥ 3:1 sur toutes les
 * surfaces — WCAG 1.4.11) et le fond est un puits (`bg-sunken`).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-control bg-sunken px-3 py-1 text-base transition-ui outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
