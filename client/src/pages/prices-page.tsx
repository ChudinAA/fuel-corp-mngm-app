import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, Calculator, CalendarCheck } from "lucide-react";
import type { Price } from "@shared/schema";
import { AddPriceDialog } from "./prices/components/add-price-dialog";
import { PricesTable } from "./prices/components/prices-table";

export default function PricesPage() {
  const [activeTab, setActiveTab] = useState<"wholesale" | "refueling">("wholesale");
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Цены</h1>
          <p className="text-muted-foreground">Управление ценами с проверкой пересечения диапазонов</p>
        </div>
        <AddPriceDialog editPrice={editingPrice} onEditComplete={() => setEditingPrice(null)} />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "wholesale" | "refueling")}>
        <TabsList>
          <TabsTrigger value="wholesale">ОПТ</TabsTrigger>
          <TabsTrigger value="refueling">Заправка ВС</TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены закупки (Поставщики)</CardTitle>
              <CardDescription>Цены от поставщиков для оптовой торговли</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="supplier" counterpartyType="wholesale" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены продажи (Покупатели)</CardTitle>
              <CardDescription>Цены для покупателей по оптовым сделкам</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="buyer" counterpartyType="wholesale" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refueling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены закупки (Поставщики)</CardTitle>
              <CardDescription>Цены от поставщиков для заправок ВС</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="supplier" counterpartyType="refueling" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены продажи (Покупатели)</CardTitle>
              <CardDescription>Цены для покупателей по заправкам ВС</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="buyer" counterpartyType="refueling" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}