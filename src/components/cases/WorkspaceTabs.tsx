"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  Clock,
  ShieldAlert,
  FileText,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "graphe", label: "Graphe", icon: Network },
  { slug: "timeline", label: "Timeline", icon: Clock },
  { slug: "risques", label: "Risques", icon: ShieldAlert },
  { slug: "analyse", label: "Analyse", icon: BarChart3 },
  { slug: "sources", label: "Sources", icon: FileText },
];

export default function WorkspaceTabs({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-b border-border px-4">
      {TABS.map(({ slug, label, icon: Icon }) => {
        const href = `/cases/${caseId}/${slug}`;
        const active = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
