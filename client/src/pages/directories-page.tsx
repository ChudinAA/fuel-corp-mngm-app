
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Building2, Car, Container, User, Truck } from "lucide-react";
import { BasesTab } from "./directories/bases-tab";
import { GenericLogisticsTab } from "./directories/generic-logistics-tab";

export default function DirectoriesPage() {
  const [activeTab, setActiveTab] = useState<string>("bases");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Справочники</h1>
        <p className="text-muted-foreground">Управление справочными данными системы</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bases" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Базисы
          </TabsTrigger>
          <TabsTrigger value="delivery_locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Места доставки
          </TabsTrigger>
          <TabsTrigger value="carriers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Перевозчики
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Водители
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Транспорт
          </TabsTrigger>
          <TabsTrigger value="trailers" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            Прицепы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bases">
          <BasesTab />
        </TabsContent>

        <TabsContent value="delivery_locations">
          <GenericLogisticsTab 
            type="delivery_location" 
            title="Места доставки" 
            description="Управление точками выгрузки"
            icon={MapPin}
          />
        </TabsContent>

        <TabsContent value="carriers">
          <GenericLogisticsTab 
            type="carrier" 
            title="Перевозчики" 
            description="Транспортные компании"
            icon={Building2}
          />
        </TabsContent>

        <TabsContent value="drivers">
          <GenericLogisticsTab 
            type="driver" 
            title="Водители" 
            description="Список водителей перевозчиков"
            icon={User}
          />
        </TabsContent>

        <TabsContent value="vehicles">
          <GenericLogisticsTab 
            type="vehicle" 
            title="Транспорт" 
            description="Грузовые автомобили и бензовозы"
            icon={Car}
          />
        </TabsContent>

        <TabsContent value="trailers">
          <GenericLogisticsTab 
            type="trailer" 
            title="Прицепы" 
            description="Цистерны и полуприцепы"
            icon={Container}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
