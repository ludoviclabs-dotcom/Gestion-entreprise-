import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Liste déroulante NATIVE, habillée comme <Input> (bordure `border-control`,
 * puits `bg-sunken`, anneau de focus). Le contrôle natif reste celui du système :
 * accessible au clavier et au lecteur d'écran, sélecteur plein écran sur mobile.
 * Pour un menu d'actions, utiliser DropdownMenu.
 */
function NativeSelect({
  className,
  size = "md",
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "md" }) {
  return (
    <div data-slot="native-select-wrapper" className="relative min-w-0">
      <select
        data-slot="native-select"
        className={cn(
          "w-full min-w-0 appearance-none rounded-md border border-control bg-sunken pr-8 pl-2.5 text-foreground transition-ui outline-none hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "sm" ? "h-8 text-sm" : "h-9 text-base md:text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  )
}

export { NativeSelect }
