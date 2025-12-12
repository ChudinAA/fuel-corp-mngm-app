
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MapPin, Truck, Users } from "lucide-react";
import { SuppliersTab } from "./directories/suppliers-tab";
import { BasesTab } from "./directories/bases-tab";
import { LogisticsTab } from "./directories/logistics-tab";
import { CustomersTab } from "./directories/customers-tab";

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "bases" | "customers" | "logistics">("suppliers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-muted-foreground">Управление справочными данными системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="suppliers" className="flex items-center gap-2" data-testid="tab-suppliers">
            <Building2 className="h-4 w-4" />
            Поставщики
          </TabsTrigger>
          <TabsTrigger value="bases" className="flex items-center gap-2" data-testid="tab-bases">
            <MapPin className="h-4 w-4" />
            Базисы
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2" data-testid="tab-customers">
            <Users className="h-4 w-4" />
            Покупатели
          </TabsTrigger>
          <TabsTrigger value="logistics" className="flex items-center gap-2" data-testid="tab-logistics">
            <Truck className="h-4 w-4" />
            Логистика
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>

        <TabsContent value="bases">
          <BasesTab />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>

        <TabsContent value="logistics">
          <LogisticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
