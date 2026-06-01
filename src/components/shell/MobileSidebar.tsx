"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SidebarContent from "./SidebarContent";

export default function MobileSidebar({ demoMode }: { demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:text-foreground md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={16} />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Menu principal de l&apos;application.</SheetDescription>
        </SheetHeader>
        <SidebarContent demoMode={demoMode} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
