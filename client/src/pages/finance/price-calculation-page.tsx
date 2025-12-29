
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calculator } from "lucide-react";
import { PriceCalculationDialog } from "./components/price-calculation-dialog";
import { PriceCalculationTable } from "./components/price-calculation-table";
import { PriceCalculator } from "./components/price-calculator";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PriceCalculationPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { hasPermission } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Расчет цены</h1>
          <p className="text-muted-foreground">Калькулятор стоимости и управление шаблонами</p>
        </div>
        {hasPermission("finance", "create") && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать расчет
          </Button>
        )}
      </div>

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Калькулятор
          </TabsTrigger>
          <TabsTrigger value="saved">Сохраненные расчеты</TabsTrigger>
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator">
          <PriceCalculator />
        </TabsContent>

        <TabsContent value="saved">
          <Card>
            <CardHeader>
              <CardTitle>Сохраненные расчеты</CardTitle>
              <CardDescription>История всех расчетов цены</CardDescription>
            </CardHeader>
            <CardContent>
              <PriceCalculationTable templateFilter={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Шаблоны расчетов</CardTitle>
              <CardDescription>Сохраненные шаблоны для быстрого расчета</CardDescription>
            </CardHeader>
            <CardContent>
              <PriceCalculationTable templateFilter={true} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PriceCalculationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
