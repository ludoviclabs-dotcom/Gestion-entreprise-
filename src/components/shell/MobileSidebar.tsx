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

export default function MobileSidebar({ demoMode }: { demoMode: boolean }) {
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
