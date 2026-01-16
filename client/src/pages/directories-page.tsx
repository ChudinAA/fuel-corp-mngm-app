
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Truck } from "lucide-react";
import { BasesTab } from "./directories/bases-tab";
import { LogisticsTab } from "./directories/logistics-tab";

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<"bases" | "logistics">("bases");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-muted-foreground">Управление справочными данными системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="bases" className="flex items-center gap-2" data-testid="tab-bases">
            <MapPin className="h-4 w-4" />
            Базисы
          </TabsTrigger>
          <TabsTrigger value="logistics" className="flex items-center gap-2" data-testid="tab-logistics">
            <Truck className="h-4 w-4" />
            Логистика
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bases">
          <BasesTab />
        </TabsContent>

        <TabsContent value="logistics">
          <LogisticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
