import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Train, Banknote } from "lucide-react";
import { RailwayStationsTab } from "./directories/railway-stations-tab";
import { RailwayTariffsTab } from "./directories/railway-tariffs-tab";

export default function ExchangeDirectoriesPage() {
  const [activeTab, setActiveTab] = useState<string>("railway_stations");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники Биржи</h1>
        <p className="text-muted-foreground">Справочные данные для биржевых операций</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="railway_stations" className="flex items-center gap-2">
            <Train className="h-4 w-4" />
            ЖД Станции
          </TabsTrigger>
          <TabsTrigger value="railway_tariffs" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Тарифы ЖД
          </TabsTrigger>
        </TabsList>

        <TabsContent value="railway_stations">
          <RailwayStationsTab />
        </TabsContent>

        <TabsContent value="railway_tariffs">
          <RailwayTariffsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
