import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export default function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "var(--violet)",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
