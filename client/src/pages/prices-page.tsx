
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plane, TruckIcon, ShoppingCart } from "lucide-react";
import { PricesTable } from "./prices/components/prices-table";
import { COUNTERPARTY_ROLE, COUNTERPARTY_TYPE, PRODUCT_TYPE } from "@shared/constants";

export default function PricesPage() {
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [refuelingEnabled, setRefuelingEnabled] = useState(false);
  const [refuelingAbroadEnabled, setRefuelingAbroadEnabled] = useState(false);
  const [supplierEnabled, setSupplierEnabled] = useState(false);
  const [buyerEnabled, setBuyerEnabled] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");

  const getDealTypeFilter = (): "all" | "wholesale" | "refueling" | "refueling_abroad" => {
    const enabledCount = [wholesaleEnabled, refuelingEnabled, refuelingAbroadEnabled].filter(Boolean).length;
    if (enabledCount === 0 || enabledCount > 1) return "all";
    if (wholesaleEnabled) return COUNTERPARTY_TYPE.WHOLESALE;
    if (refuelingEnabled) return COUNTERPARTY_TYPE.REFUELING;
    if (refuelingAbroadEnabled) return COUNTERPARTY_TYPE.REFUELING_ABROAD;
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
    <div className="space-y-4">

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Список цен</CardTitle>
        </CardHeader>
        <CardContent>
          
          <PricesTable 
            dealTypeFilter={getDealTypeFilter()} 
            roleFilter={getRoleFilter()}
            productTypeFilter={productTypeFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
