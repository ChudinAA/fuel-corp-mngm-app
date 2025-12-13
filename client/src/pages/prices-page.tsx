
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Price } from "@shared/schema";
import { AddPriceDialog } from "./prices/components/add-price-dialog";
import { PricesTable } from "./prices/components/prices-table";

export default function PricesPage() {
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [dealTypeFilter, setDealTypeFilter] = useState<"all" | "wholesale" | "refueling">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "supplier" | "buyer">("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Цены</h1>
          <p className="text-muted-foreground">Управление ценами с проверкой пересечения диапазонов</p>
        </div>
        <AddPriceDialog editPrice={editingPrice} onEditComplete={() => setEditingPrice(null)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
          <CardDescription>Выберите тип сделки и роль контрагента</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Тип сделки</Label>
              <Select value={dealTypeFilter} onValueChange={(v) => setDealTypeFilter(v as typeof dealTypeFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="wholesale">ОПТ</SelectItem>
                  <SelectItem value="refueling">Заправка ВС</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Роль контрагента</Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="supplier">Поставщик</SelectItem>
                  <SelectItem value="buyer">Покупатель</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Список цен</CardTitle>
          <CardDescription>Все цены покупки и продажи</CardDescription>
        </CardHeader>
        <CardContent>
          <PricesTable 
            dealTypeFilter={dealTypeFilter} 
            roleFilter={roleFilter}
            onEdit={setEditingPrice}
          />
        </CardContent>
      </Card>
    </div>
  );
}
