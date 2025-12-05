
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Calculator, CalendarCheck, AlertTriangle } from "lucide-react";

interface PriceChecksPanelProps {
  selectionResult: string | null;
  dateCheckResult: {
    status: string;
    message: string;
    overlaps?: { id: number; dateFrom: string; dateTo: string }[];
  } | null;
  onCalculateSelection: () => void;
  onCheckDates: () => void;
  isCalculating: boolean;
  isChecking: boolean;
}

export function PriceChecksPanel({
  selectionResult,
  dateCheckResult,
  onCalculateSelection,
  onCheckDates,
  isCalculating,
  isChecking,
}: PriceChecksPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Выборка</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onCalculateSelection}
                disabled={isCalculating}
                data-testid="button-calculate-selection"
              >
                {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Рассчитать сумму сделок из ОПТ и Заправка ВС</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-lg font-semibold">
          {selectionResult ? `${new Intl.NumberFormat('ru-RU').format(parseFloat(selectionResult))} кг` : "—"}
        </div>
        <p className="text-xs text-muted-foreground">Суммирует все сделки по контрагенту, базису и периоду</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Проверка дат</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={onCheckDates}
                disabled={isChecking}
                data-testid="button-check-dates"
              >
                {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Проверить пересечение диапазонов дат</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div>
          {dateCheckResult ? (
            <Badge variant={dateCheckResult.status === "error" ? "destructive" : dateCheckResult.status === "warning" ? "outline" : "default"} className="flex items-center gap-1 w-fit">
              {dateCheckResult.status === "error" && <AlertTriangle className="h-3 w-3" />}
              {dateCheckResult.status === "error" ? "Двойная цена!" : dateCheckResult.status === "warning" ? "Внимание" : "ОК"}
            </Badge>
          ) : (
            <span className="text-lg font-semibold">—</span>
          )}
        </div>
        {dateCheckResult?.overlaps && dateCheckResult.overlaps.length > 0 && (
          <div className="text-xs text-destructive">
            Пересечения: {dateCheckResult.overlaps.map(o => `#${o.id}`).join(", ")}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Проверяет задвоение цен по диапазонам дат</p>
      </div>
    </div>
  );
}
