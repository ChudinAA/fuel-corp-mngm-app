
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MonthlyPlanPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Ежемесячный план</h1>
        <p className="text-muted-foreground mt-2">
          Планирование продаж и объемов складов
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Планирование</CardTitle>
          <CardDescription>
            Функционал в разработке
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            Модуль находится в разработке
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
