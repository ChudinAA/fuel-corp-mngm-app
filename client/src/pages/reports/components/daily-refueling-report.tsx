
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DailyRefuelingReportProps {
  date: string;
}

export function DailyRefuelingReport({ date }: DailyRefuelingReportProps) {
  const { data: refuelingData, isLoading } = useQuery({
    queryKey: ["/api/aircraft-refueling", { date }],
    queryFn: async () => {
      const response = await fetch(`/api/aircraft-refueling?date=${date}`);
      if (!response.ok) throw new Error("Failed to fetch refueling data");
      return response.json();
    },
  });

  const filteredOperations = refuelingData?.data?.filter((op: any) => 
    op.refuelingDate?.startsWith(date)
  ) || [];

  const totalQuantity = filteredOperations.reduce((sum: number, op: any) => 
    sum + (parseFloat(op.quantityLiters) || 0), 0
  );
  const totalRevenue = filteredOperations.reduce((sum: number, op: any) => 
    sum + (parseFloat(op.totalAmount) || 0), 0
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Количество заправок</CardDescription>
            <CardTitle className="text-2xl">{filteredOperations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Объем (л)</CardDescription>
            <CardTitle className="text-2xl">{totalQuantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Выручка</CardDescription>
            <CardTitle className="text-2xl text-green-600">{totalRevenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Заправки ЗВС</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOperations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет заправок за выбранную дату
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Борт №</TableHead>
                    <TableHead>Тип топлива</TableHead>
                    <TableHead>Покупатель</TableHead>
                    <TableHead className="text-right">Объем (л)</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOperations.map((op: any) => (
                    <TableRow key={op.id}>
                      <TableCell>{new Date(op.refuelingDate).toLocaleDateString('ru-RU')}</TableCell>
                      <TableCell>{op.aircraftNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{op.productType}</Badge>
                      </TableCell>
                      <TableCell>{op.buyer?.name || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {parseFloat(op.quantityLiters || 0).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(op.salePrice || 0).toLocaleString('ru-RU')} ₽
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(op.totalAmount || 0).toLocaleString('ru-RU')} ₽
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
