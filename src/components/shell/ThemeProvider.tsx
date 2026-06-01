"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Provider de thème (next-themes) — `dark` par défaut pour préserver
 * l'identité « carte réseau sombre », `system` pour respecter l'OS,
 * `light` disponible (utile pour impression et certaines DSI/administrations
 * — recommandation de l'audit).
 */
export default function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
