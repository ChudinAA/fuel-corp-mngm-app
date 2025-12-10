
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, MapPin } from "lucide-react";
import { formatNumber } from "../utils";

interface DeliveryStatsCardsProps {
  totalRoutes: number;
  averageCostPerKg: number;
  activeCarriersCount: number;
}

export function DeliveryStatsCards({ 
  totalRoutes, 
  averageCostPerKg, 
  activeCarriersCount 
}: DeliveryStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Всего маршрутов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{totalRoutes}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Средняя стоимость за кг
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatNumber(averageCostPerKg)} ₽</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Активные перевозчики</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{activeCarriersCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}
