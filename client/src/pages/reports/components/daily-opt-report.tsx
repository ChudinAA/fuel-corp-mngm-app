
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface DailyOptReportProps {
  date: string;
}

export function DailyOptReport({ date }: DailyOptReportProps) {
  const { data: optDeals, isLoading } = useQuery({
    queryKey: ["/api/opt", { date }],
    queryFn: async () => {
      const response = await fetch(`/api/opt?date=${date}`);
      if (!response.ok) throw new Error("Failed to fetch OPT deals");
      return response.json();
    },
  });

  const filteredDeals = optDeals?.data?.filter((deal: any) => 
    deal.dealDate?.startsWith(date)
  ) || [];

  const totalQuantity = filteredDeals.reduce((sum: number, deal: any) => 
    sum + (parseFloat(deal.quantityKg) || 0), 0
  );
  const totalPurchase = filteredDeals.reduce((sum: number, deal: any) => 
    sum + (parseFloat(deal.purchaseAmount) || 0), 0
  );
  const totalSales = filteredDeals.reduce((sum: number, deal: any) => 
    sum + (parseFloat(deal.saleAmount) || 0), 0
  );
  const totalProfit = filteredDeals.reduce((sum: number, deal: any) => 
    sum + (parseFloat(deal.profit) || 0), 0
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Количество сделок</CardDescription>
            <CardTitle className="text-2xl">{filteredDeals.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Объем (кг)</CardDescription>
            <CardTitle className="text-2xl">{totalQuantity.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Выручка</CardDescription>
            <CardTitle className="text-2xl">{totalSales.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Прибыль</CardDescription>
            <CardTitle className="text-2xl text-green-600">{totalProfit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сделки ОПТ</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет сделок за выбранную дату
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead>Покупатель</TableHead>
                    <TableHead>Базис</TableHead>
                    <TableHead className="text-right">Объем (кг)</TableHead>
                    <TableHead className="text-right">Закупка</TableHead>
                    <TableHead className="text-right">Продажа</TableHead>
                    <TableHead className="text-right">Прибыль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeals.map((deal: any) => (
                    <TableRow key={deal.id}>
                      <TableCell>{new Date(deal.dealDate).toLocaleDateString('ru-RU')}</TableCell>
                      <TableCell>{deal.supplier?.name || '-'}</TableCell>
                      <TableCell>{deal.buyer?.name || '-'}</TableCell>
                      <TableCell>{deal.basis || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {parseFloat(deal.quantityKg || 0).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(deal.purchaseAmount || 0).toLocaleString('ru-RU')} ₽
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(deal.saleAmount || 0).toLocaleString('ru-RU')} ₽
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={parseFloat(deal.profit) > 0 ? "default" : "destructive"}>
                          {parseFloat(deal.profit || 0).toLocaleString('ru-RU')} ₽
                        </Badge>
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
