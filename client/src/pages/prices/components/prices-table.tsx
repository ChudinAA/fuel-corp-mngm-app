
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Pencil, Trash2, RefreshCw, CalendarCheck, AlertTriangle } from "lucide-react";
import type { Price, WholesaleSupplier, RefuelingProvider } from "@shared/schema";
import type { PricesTableProps } from "../types";
import { formatNumber, formatDate, getPriceDisplay, getProductTypeLabel } from "../utils";
import { usePriceSelection } from "../hooks/use-price-selection";
import { useDateCheck } from "../hooks/use-date-check";
import { AddPriceDialog } from "./add-price-dialog";

export function PricesTable({ counterpartyRole, counterpartyType }: PricesTableProps) {
  const [search, setSearch] = useState("");
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const { toast } = useToast();

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: optContractors } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: refuelingContractors } = useQuery<RefuelingProvider[]>({
    queryKey: ["api/refueling/providers"],
  });

  const selectionCheck = usePriceSelection();
  const dateCheck = useDateCheck();

  const getContractorName = (id: string, type: string) => {
    const contractors = type === "wholesale" ? optContractors : refuelingContractors;
    return contractors?.find(c => c.id === id)?.name || `ID: ${id}`;
  };

  const filteredPrices = prices?.filter(p => 
    p.counterpartyRole === counterpartyRole && 
    p.counterpartyType === counterpartyType &&
    (!search || p.basis?.toLowerCase().includes(search.toLowerCase()) || getContractorName(p.counterpartyId, p.counterpartyType).toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const deleteMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("DELETE", `/api/prices/${priceId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Цена удалена", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить цену", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по базису или контрагенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Период</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Базис</TableHead>
              <TableHead>Продукт</TableHead>
              <TableHead className="text-right">Цена (₽/кг)</TableHead>
              <TableHead className="text-right">Объем</TableHead>
              <TableHead className="text-right">Выборка</TableHead>
              <TableHead>Даты</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Нет данных</TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((price) => (
                <TableRow key={price.id} data-testid={`row-price-${price.id}`}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(price.dateFrom)} - {formatDate(price.dateTo)}</TableCell>
                  <TableCell>{getContractorName(price.counterpartyId, price.counterpartyType)}</TableCell>
                  <TableCell>{price.basis || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getProductTypeLabel(price.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{getPriceDisplay(price.priceValues)}</TableCell>
                  <TableCell className="text-right">{price.volume ? `${formatNumber(price.volume)} кг` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{price.soldVolume ? `${formatNumber(price.soldVolume)} кг` : "—"}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => selectionCheck.calculateForPrice.mutate(price)}
                            disabled={selectionCheck.calculateForPrice.isPending}
                            data-testid={`button-calc-selection-${price.id}`}
                          >
                            <RefreshCw className={`h-3 w-3 ${selectionCheck.calculateForPrice.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Пересчитать выборку</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {price.dateCheckWarning === "error" ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Пересечение
                        </Badge>
                      ) : price.dateCheckWarning === "warning" ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          Внимание
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">ОК</Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => dateCheck.checkForPrice.mutate(price)}
                            disabled={dateCheck.checkForPrice.isPending}
                            data-testid={`button-check-dates-${price.id}`}
                          >
                            <CalendarCheck className={`h-3 w-3 ${dateCheck.checkForPrice.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Проверить даты</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        data-testid={`button-edit-price-${price.id}`}
                        onClick={() => setEditingPrice(price)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive" 
                        onClick={() => {
                          if (confirm("Вы уверены, что хотите удалить эту цену?")) {
                            deleteMutation.mutate(price.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-price-${price.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
