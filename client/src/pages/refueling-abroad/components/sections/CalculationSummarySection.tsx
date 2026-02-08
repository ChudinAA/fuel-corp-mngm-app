import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "../../utils";

interface CalculationSummarySectionProps {
  calculations: any;
  purchaseExchangeRate: number;
  saleExchangeRate: number;
  totalIntermediaryCommissionUsd: number;
  totalIntermediaryCommissionRub: number;
}

export function CalculationSummarySection({
  calculations,
  purchaseExchangeRate,
  saleExchangeRate,
  totalIntermediaryCommissionUsd,
  totalIntermediaryCommissionRub,
}: CalculationSummarySectionProps) {
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Итоговые расчеты</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Объем (кг):</p>
            <p className="font-semibold text-base">
              {formatNumber(calculations.finalKg)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Цена закупки:</p>
            <p className="font-medium">
              {formatCurrency(calculations.purchasePrice || 0, "USD")} /{" "}
              {formatCurrency(
                (calculations.purchasePrice || 0) * purchaseExchangeRate,
                "RUB",
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Цена продажи:</p>
            <p className="font-medium">
              {formatCurrency(calculations.salePrice || 0, "USD")} /{" "}
              {formatCurrency(
                (calculations.salePrice || 0) * saleExchangeRate,
                "RUB",
              )}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Сумма закупки:</p>
            <p className="font-semibold text-destructive">
              {formatCurrency(calculations.purchaseAmountUsd || 0, "USD")} /{" "}
              {formatCurrency(calculations.purchaseAmountRub || 0, "RUB")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Сумма продажи:</p>
            <p className="font-semibold text-primary">
              {formatCurrency(calculations.saleAmountUsd || 0, "USD")} /{" "}
              {formatCurrency(calculations.saleAmountRub || 0, "RUB")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Прибыль:</p>
            <p
              className={`font-bold text-base ${
                (calculations.profitUsd || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(calculations.profitUsd || 0, "USD")} /{" "}
              {formatCurrency(calculations.profitRub || 0, "RUB")}
            </p>
          </div>

          <div className="col-span-1 md:col-span-3 pt-2 border-t mt-2">
            <p className="text-muted-foreground text-xs mb-1">
              Комиссия всех посредников:
            </p>
            <p className="font-medium text-amber-600">
              {formatCurrency(totalIntermediaryCommissionUsd, "USD")} /{" "}
              {formatCurrency(totalIntermediaryCommissionRub, "RUB")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
