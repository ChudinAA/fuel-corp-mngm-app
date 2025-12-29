
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyOperationsReport } from "./components/daily-operations-report";
import { CustomPeriodReport } from "./components/custom-period-report";

export default function DailyReportsPage() {
  const [activeTab, setActiveTab] = useState("daily");

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Текущие отчеты</h1>
        <p className="text-muted-foreground mt-2">
          Отчеты по операциям за день или произвольный период до месяца
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="daily">За день</TabsTrigger>
          <TabsTrigger value="period">За период</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-6">
          <DailyOperationsReport />
        </TabsContent>

        <TabsContent value="period" className="mt-6">
          <CustomPeriodReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
