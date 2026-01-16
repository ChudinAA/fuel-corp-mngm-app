import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users } from "lucide-react";
import { SuppliersTab } from "./suppliers-tab";
import { CustomersTab } from "./customers-tab";

export default function CounterpartiesPage() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "customers">("suppliers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Контрагенты</h1>
        <p className="text-muted-foreground">Управление поставщиками и покупателями системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="suppliers" className="flex items-center gap-2" data-testid="tab-suppliers">
            <Building2 className="h-4 w-4" />
            Поставщики
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-2" data-testid="tab-customers">
            <Users className="h-4 w-4" />
            Покупатели
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
