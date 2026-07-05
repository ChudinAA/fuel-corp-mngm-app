import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { PlanningPeriod } from "../planning-page";

interface ResourceSummaryRow {
  supplierId: string;
  supplierName: string;
  allocatedVolume: string;
  demand: string;
  balance: string;
}

interface WarehouseSummaryRow {
  warehouseId: string;
  warehouseName: string;
  plannedIncome: string;
  plannedExpense: string;
  balance: string;
}

interface CustomerSummaryRow {
  customerId: string;
  customerName: string;
  volume: string;
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    periodFrom: format(period.from, "yyyy-MM-dd"),
    periodTo: format(period.to, "yyyy-MM-dd"),
  };
}

function AllocatedVolumeCell({
  supplierId,
  value,
  periodFrom,
  periodTo,
  canEdit,
}: {
  supplierId: string;
  value: string;
  periodFrom: string;
  periodTo: string;
  canEdit: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);

  const handleBlur = async () => {
    if (localValue === value) return;
    try {
      await apiRequest("POST", "/api/planning/allocated-volumes", {
        supplierId,
        periodFrom,
        periodTo,
        volume: localValue || "0",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
    } catch {
      setLocalValue(value);
    }
  };

  if (!canEdit) {
    return <span data-testid={`text-allocated-volume-${supplierId}`}>{value}</span>;
  }

  return (
    <Input
      type="number"
      step="0.01"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      className="h-8 w-32"
      data-testid={`input-allocated-volume-${supplierId}`}
    />
  );
}

export function VolumesTab({ period }: { period: PlanningPeriod }) {
  const { hasPermission } = useAuth();
  const canAllocate = hasPermission("planning", "allocate");
  const { periodFrom, periodTo } = fmtPeriod(period);

  const { data: resources = [], isLoading: loadingResources } = useQuery<ResourceSummaryRow[]>({
    queryKey: ["/api/planning/summary/resources", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/resources?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      );
      return res.json();
    },
  });

  const { data: warehousesSummary = [], isLoading: loadingWarehouses } = useQuery<
    WarehouseSummaryRow[]
  >({
    queryKey: ["/api/planning/summary/warehouses", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/warehouses?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      );
      return res.json();
    },
  });

  const { data: customersSummary = [], isLoading: loadingCustomers } = useQuery<
    CustomerSummaryRow[]
  >({
    queryKey: ["/api/planning/summary/customers", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/customers?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      );
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ресурсы (поставщики)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Поставщик</TableHead>
                <TableHead>Выделенный объём</TableHead>
                <TableHead>Потребность</TableHead>
                <TableHead>Баланс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingResources ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : resources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Нет данных за выбранный период
                  </TableCell>
                </TableRow>
              ) : (
                resources.map((row) => (
                  <TableRow key={row.supplierId} data-testid={`row-resource-${row.supplierId}`}>
                    <TableCell>{row.supplierName}</TableCell>
                    <TableCell>
                      <AllocatedVolumeCell
                        supplierId={row.supplierId}
                        value={row.allocatedVolume}
                        periodFrom={periodFrom}
                        periodTo={periodTo}
                        canEdit={canAllocate}
                      />
                    </TableCell>
                    <TableCell>{row.demand}</TableCell>
                    <TableCell
                      className={
                        parseFloat(row.balance) < 0 ? "text-destructive" : undefined
                      }
                    >
                      {row.balance}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Данные по складам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Склад</TableHead>
                <TableHead>Планируемый приход</TableHead>
                <TableHead>Планируемый расход</TableHead>
                <TableHead>Остаток</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingWarehouses ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : warehousesSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                warehousesSummary.map((row) => (
                  <TableRow key={row.warehouseId} data-testid={`row-warehouse-${row.warehouseId}`}>
                    <TableCell>{row.warehouseName}</TableCell>
                    <TableCell>{row.plannedIncome}</TableCell>
                    <TableCell>{row.plannedExpense}</TableCell>
                    <TableCell>{row.balance}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Данные по клиентам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Объём</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCustomers ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : customersSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                customersSummary.map((row) => (
                  <TableRow key={row.customerId} data-testid={`row-customer-${row.customerId}`}>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.volume}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
