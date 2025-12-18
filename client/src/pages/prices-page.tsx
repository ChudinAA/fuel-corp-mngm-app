
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plane, TruckIcon, ShoppingCart } from "lucide-react";
import type { Price } from "@shared/schema";
import { AddPriceDialog } from "./prices/components/add-price-dialog";
import { PricesTable } from "./prices/components/prices-table";
import { COUNTERPARTY_ROLE, COUNTERPARTY_TYPE, PRODUCT_TYPE } from "@shared/constants";

export default function PricesPage() {
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [refuelingEnabled, setRefuelingEnabled] = useState(false);
  const [supplierEnabled, setSupplierEnabled] = useState(false);
  const [buyerEnabled, setBuyerEnabled] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");

  const getDealTypeFilter = (): "all" | "wholesale" | "refueling" => {
    if (!wholesaleEnabled && !refuelingEnabled) return "all";
    if (wholesaleEnabled && refuelingEnabled) return "all";
    if (wholesaleEnabled) return COUNTERPARTY_TYPE.WHOLESALE;
    if (refuelingEnabled) return COUNTERPARTY_TYPE.REFUELING;
    return "all";
  };

  const getRoleFilter = (): "all" | "supplier" | "buyer" => {
    if (!supplierEnabled && !buyerEnabled) return "all";
    if (supplierEnabled && buyerEnabled) return "all";
    if (supplierEnabled) return COUNTERPARTY_ROLE.SUPPLIER;
    if (buyerEnabled) return COUNTERPARTY_ROLE.BUYER;
    return "all";
  };

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
          <CardTitle className="text-lg">Список цен</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button
              variant={wholesaleEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setWholesaleEnabled(!wholesaleEnabled)}
              className="gap-2"
            >
              <Package className={`h-4 w-4 ${!wholesaleEnabled ? 'text-blue-500' : ''}`} />
              ОПТ
            </Button>
            <Button
              variant={refuelingEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setRefuelingEnabled(!refuelingEnabled)}
              className="gap-2"
            >
              <Plane className={`h-4 w-4 ${!refuelingEnabled ? 'text-purple-500' : ''}`} />
              Заправка ВС
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant={supplierEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSupplierEnabled(!supplierEnabled)}
              className="gap-2"
            >
              <TruckIcon className={`h-4 w-4 ${!supplierEnabled ? 'text-green-500' : ''}`} />
              Поставщик
            </Button>
            <Button
              variant={buyerEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setBuyerEnabled(!buyerEnabled)}
              className="gap-2"
            >
              <ShoppingCart className={`h-4 w-4 ${!buyerEnabled ? 'text-orange-500' : ''}`} />
              Покупатель
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Тип продукта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все продукты</SelectItem>
                <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                <SelectItem value={PRODUCT_TYPE.SERVICE}>Услуги</SelectItem>
                <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
                <SelectItem value={PRODUCT_TYPE.AGENT}>Агентское</SelectItem>
                <SelectItem value={PRODUCT_TYPE.STORAGE}>Хранение</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PricesTable 
            dealTypeFilter={getDealTypeFilter()} 
            roleFilter={getRoleFilter()}
            productTypeFilter={productTypeFilter}
            onEdit={setEditingPrice}
          />
        </CardContent>
      </Card>
    </div>
  );
}
