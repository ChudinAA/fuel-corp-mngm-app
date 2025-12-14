import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatCurrency } from "../utils";
import { Package, DollarSign } from "lucide-react";

interface WarehouseStatsCardsProps {
  warehousesCount: number;
  totalBalance: number;
  averageCost: number;
  totalPvkjBalance?: number;
  averagePvkjCost?: number;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
}

export function WarehouseStatsCards({
  warehousesCount,
  totalBalance,
  averageCost,
  totalPvkjBalance = 0,
  averagePvkjCost = 0,
  formatNumber,
  formatCurrency,
}: WarehouseStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Всего складов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{warehousesCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" />
            Керосин (остаток)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatNumber(totalBalance)} кг</p>
          <p className="text-xs text-muted-foreground mt-1">Себестоимость: {formatCurrency(averageCost)}/кг</p>
        </CardContent>
      </Card>
      {totalPvkjBalance > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              ПВКЖ (остаток)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(totalPvkjBalance)} кг</p>
            <p className="text-xs text-muted-foreground mt-1">Себестоимость: {formatCurrency(averagePvkjCost)}/кг</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}