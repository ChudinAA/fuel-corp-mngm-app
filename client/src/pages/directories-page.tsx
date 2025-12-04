import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plane, Truck, Users } from "lucide-react";
import { WholesaleTab } from "./directories/wholesale-tab";
import { RefuelingTab } from "./directories/refueling-tab";
import { LogisticsTab } from "./directories/logistics-tab";
import { CustomersTab } from "./directories/customers-tab";

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<"wholesale" | "refueling" | "logistics" | "customers">("wholesale");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-muted-foreground">Управление справочными данными системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="wholesale" className="flex items-center gap-2" data-testid="tab-wholesale">
            <Building2 className="h-4 w-4" />
            ОПТ
          </TabsTrigger>
          <TabsTrigger value="refueling" className="flex items-center gap-2" data-testid="tab-refueling">
            <Plane className="h-4 w-4" />
            Заправка ВС
          </TabsTrigger>
          <TabsTrigger value="logistics" className="flex items-center gap-2" data-testid="tab-logistics">
            <Truck className="h-4 w-4" />
            Логистика
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2" data-testid="tab-customers">
            <Users className="h-4 w-4" />
            Покупатели
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale">
          <WholesaleTab />
        </TabsContent>

        <TabsContent value="refueling">
          <RefuelingTab />
        </TabsContent>

        <TabsContent value="logistics">
          <LogisticsTab />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}