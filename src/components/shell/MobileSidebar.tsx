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
import { IconButton } from "@/components/ui/icon-button";
import SidebarContent from "./SidebarContent";
import type { NavReview } from "./nav";

/** Tiroir de navigation (< md) : mêmes entrées et libellés complets que la sidebar. */
export default function MobileSidebar({ review }: { review?: NavReview }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton
          label="Ouvrir le menu"
          icon={Menu}
          variant="outline"
          tooltip={false}
          className="md:hidden"
        />
      </SheetTrigger>
      <SheetContent side="left" className="w-[var(--layout-sidebar-width)] max-w-[85vw] bg-sidebar p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Menu principal de l&apos;application.</SheetDescription>
        </SheetHeader>
        <SidebarContent review={review} instance="drawer" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
