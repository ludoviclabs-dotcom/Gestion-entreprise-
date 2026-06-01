"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import CaseStatusBadge from "./CaseStatusBadge";
import ScorePills from "./ScorePills";
import type { CaseSummary } from "@/lib/data/types";

type SortKey = "title" | "updatedAt" | "vigilance";

export default function CasesTable({ cases }: { cases: CaseSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? cases.filter(
          (c) =>
            c.title.toLowerCase().includes(q) || c.rootSiren.includes(q),
        )
      : cases;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "updatedAt") cmp = a.updatedAt.localeCompare(b.updatedAt);
      else cmp = (a.scores.vigilance ?? -1) - (b.scores.vigilance ?? -1);
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, [cases, query, sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom ou SIREN…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} dossier{rows.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("title")}
                  className="flex items-center gap-1"
                >
                  Titre <ArrowUpDown size={12} />
                </button>
              </TableHead>
              <TableHead>SIREN</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("vigilance")}
                  className="flex items-center gap-1"
                >
                  Scores <ArrowUpDown size={12} />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("updatedAt")}
                  className="ml-auto flex items-center gap-1"
                >
                  Mis à jour <ArrowUpDown size={12} />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}/graphe`)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.rootSiren}
                </TableCell>
                <TableCell>
                  <CaseStatusBadge status={c.status} />
                </TableCell>
                <TableCell>
                  <ScorePills scores={c.scores} size="sm" />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString("fr-FR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
