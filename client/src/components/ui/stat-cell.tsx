import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type StatMode = "sum" | "avg" | "min" | "max" | "count";

interface StatCellProps {
  values: (number | string | null | undefined)[];
  className?: string;
  formatFn?: (v: number) => string;
  align?: "left" | "right";
}

const MODES: { key: StatMode; label: string }[] = [
  { key: "sum", label: "Сумма" },
  { key: "avg", label: "Среднее" },
  { key: "min", label: "Мин" },
  { key: "max", label: "Макс" },
  { key: "count", label: "Кол-во записей" },
];

function calcStat(nums: number[], mode: StatMode): number {
  if (mode === "count") return nums.length;
  if (nums.length === 0) return 0;
  if (mode === "sum") return nums.reduce((a, b) => a + b, 0);
  if (mode === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (mode === "min") return Math.min(...nums);
  if (mode === "max") return Math.max(...nums);
  return 0;
}

const defaultFormat = (v: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(v);

export function StatCell({ values, className, formatFn, align = "right" }: StatCellProps) {
  const [mode, setMode] = useState<StatMode>("sum");

  const nums = values
    .map((v) => (v !== null && v !== undefined && v !== "" ? parseFloat(String(v)) : NaN))
    .filter((v) => !isNaN(v));

  const fmt = formatFn ?? defaultFormat;

  const result = calcStat(nums, mode);
  const displayValue = mode === "count" ? String(result) : fmt(result);
  const modeLabel = MODES.find((m) => m.key === mode)?.label || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-full text-[10px] font-mono cursor-pointer select-none group",
            "text-muted-foreground hover:text-foreground transition-colors",
            "outline-none focus:outline-none",
            align === "right" ? "text-right" : "text-left",
            className,
          )}
          title="Нажмите для выбора агрегации"
        >
          <span className="block text-[9px] text-muted-foreground/50 leading-none mb-0.5 font-sans group-hover:text-muted-foreground/80 transition-colors">
            {modeLabel}
          </span>
          <span className="font-semibold">{displayValue}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {MODES.map((m) => {
          const val = calcStat(nums, m.key);
          const formattedVal = m.key === "count" ? String(val) : fmt(val);
          return (
            <DropdownMenuItem
              key={m.key}
              onClick={() => setMode(m.key)}
              className="text-xs flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2">
                {mode === m.key ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <span className="h-3 w-3" />
                )}
                {m.label}
              </span>
              <span className={cn("font-mono text-[11px]", mode === m.key ? "text-foreground font-semibold" : "text-muted-foreground")}>
                {formattedVal}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-3 py-1 text-[10px] text-muted-foreground/70">
          Записей в выборке: {nums.length}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
