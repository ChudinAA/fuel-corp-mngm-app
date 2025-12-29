
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BudgetPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">БДР</h1>
        <p className="text-muted-foreground mt-2">
          Бюджет доходов и расходов
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Бюджет доходов и расходов</CardTitle>
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
