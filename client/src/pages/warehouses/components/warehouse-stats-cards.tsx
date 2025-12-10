
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatCurrency } from "../utils";

interface WarehouseStatsCardsProps {
  warehousesCount: number;
  totalBalance: number;
  averageCost: number;
}

export function WarehouseStatsCards({ 
  warehousesCount, 
  totalBalance, 
  averageCost 
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
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Общий остаток
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatNumber(totalBalance)} кг</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Средняя себестоимость
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatCurrency(averageCost)}/кг</p>
        </CardContent>
      </Card>
    </div>
  );
}
