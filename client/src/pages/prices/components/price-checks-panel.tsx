
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, CalendarCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PriceChecksPanelProps {
  dateCheckResult: {
    status: string;
    message: string;
    overlaps?: { id: number; dateFrom: string; dateTo: string }[];
  } | null;
  onCheckDates: () => void;
  isChecking: boolean;
  dateCheckPassed: boolean;
}

export function PriceChecksPanel({
  dateCheckResult,
  onCheckDates,
  isChecking,
  dateCheckPassed,
}: PriceChecksPanelProps) {
  return (
    <div className="p-4 border rounded-lg bg-muted/30">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Проверка пересечения дат</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCheckDates}
                disabled={isChecking}
                data-testid="button-check-dates"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    Проверить даты
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Проверить пересечение диапазонов дат. Обязательно перед созданием!</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {dateCheckResult && (
          <div className="space-y-2">
            <Badge 
              variant={dateCheckResult.status === "error" ? "destructive" : dateCheckResult.status === "warning" ? "outline" : "default"} 
              className={`flex items-center gap-2 w-fit ${
                dateCheckResult.status === "ok" 
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" 
                  : ""
              }`}
            >
              {dateCheckResult.status === "error" && <AlertTriangle className="h-4 w-4" />}
              {dateCheckResult.status === "ok" && <CheckCircle2 className="h-4 w-4" />}
              {dateCheckResult.status === "error" ? "Двойная цена!" : dateCheckResult.status === "warning" ? "Внимание" : "ОК - можно создать"}
            </Badge>
            
            <p className="text-sm text-muted-foreground">{dateCheckResult.message}</p>
            
            {dateCheckResult.overlaps && dateCheckResult.overlaps.length > 0 && (
              <div className="text-xs text-destructive">
                Пересечения с ценами: {dateCheckResult.overlaps.map(o => `#${o.id}`).join(", ")}
              </div>
            )}
          </div>
        )}

        {!dateCheckResult && (
          <p className="text-xs text-muted-foreground">
            Перед созданием цены необходимо проверить, нет ли пересечения дат с существующими ценами
          </p>
        )}

        {dateCheckPassed && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Проверка пройдена. Можно создать цену.</span>
          </div>
        )}
      </div>
    </div>
  );
}
