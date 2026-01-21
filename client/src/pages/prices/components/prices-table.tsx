import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Package,
  Plane,
  TruckIcon,
  ShoppingCart,
  FileText,
  StickyNote,
  History,
  Filter,
} from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import type { Price, Supplier, Customer } from "@shared/schema";
import type { PricesTableProps } from "../types";
import {
  COUNTERPARTY_ROLE,
  COUNTERPARTY_TYPE,
  PRODUCT_TYPE,
} from "@shared/constants";
import { usePriceSelection } from "../hooks/use-price-selection";
import { formatNumber, formatDate, getPriceDisplay, getProductTypeLabel } from "../utils";
import { cn } from "@/lib/utils";

export function PricesTable({
  dealTypeFilter,
  roleFilter,
  productTypeFilter,
  onEdit,
}: PricesTableProps) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<Price | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices/list"],
  });

  const { data: allContractors } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const selectionCheck = usePriceSelection();

  const getContractorName = (id: string, type: string, role: string) => {
    let contractors;
    if (role === COUNTERPARTY_ROLE.BUYER) {
      contractors = customers;
    } else {
      contractors = allContractors;
    }
    return contractors?.find((c) => c.id === id)?.name || `ID: ${id}`;
  };

  const getUniqueOptions = (key: string) => {
    const values = new Map<string, string>();
    prices?.forEach((price: any) => {
      if (key === 'counterpartyId') {
        const name = getContractorName(price.counterpartyId, price.counterpartyType, price.counterpartyRole);
        values.set(name, price.counterpartyId);
      } else if (key === 'productType') {
        const label = getProductTypeLabel(price.productType);
        values.set(label, price.productType);
      } else if (key === 'date') {
        const val = formatDate(price.dateFrom);
        values.set(val, val);
      } else if (key === 'counterpartyType') {
        const label = price.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE ? "ОПТ" : "Заправка ВС";
        values.set(label, price.counterpartyType);
      } else if (key === 'counterpartyRole') {
        const label = price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER ? "Поставщик" : "Покупатель";
        values.set(label, price.counterpartyRole);
      } else {
        const val = price[key];
        if (val) values.set(String(val), String(val));
      }
    });
    return Array.from(values.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  };

  const handleFilterUpdate = (columnId: string, values: string[]) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnId]: values
    }));
  };

  const filteredPrices = useMemo(() => {
    return prices
      ?.filter((p) => {
        // Быстрые фильтры
        if (dealTypeFilter !== "all" && p.counterpartyType !== dealTypeFilter) return false;
        if (roleFilter !== "all" && p.counterpartyRole !== roleFilter) return false;
        if (productTypeFilter !== "all" && p.productType !== productTypeFilter) return false;

        // Колончатые фильтры
        for (const [columnId, selectedValues] of Object.entries(columnFilters)) {
          if (!selectedValues || selectedValues.length === 0) continue;
          
          if (columnId === 'date') {
            const dateStr = formatDate(p.dateFrom);
            if (!selectedValues.includes(dateStr)) return false;
          } else {
            const val = p[columnId as keyof Price];
            if (!selectedValues.includes(String(val))) return false;
          }
        }

        // Поиск
        if (search) {
          const searchLower = search.toLowerCase();
          const contractorName = getContractorName(
            p.counterpartyId,
            p.counterpartyType,
            p.counterpartyRole,
          ).toLowerCase();
          const basis = (p.basis || "").toLowerCase();
          if (
            !contractorName.includes(searchLower) &&
            !basis.includes(searchLower)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        return new Date(b.dateFrom).getTime() - new Date(a.dateFrom).getTime();
      }) || [];
  }, [prices, dealTypeFilter, roleFilter, productTypeFilter, columnFilters, search, customers, allContractors]);

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
      toast({
        title: "Ошибка",
        description: "Не удалось удалить цену",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по базису или контрагенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setColumnFilters({})}
          disabled={Object.values(columnFilters).every((v: any) => v.length === 0)}
          title="Сбросить все фильтры"
          className={cn(Object.values(columnFilters).some((v: any) => v.length > 0) && "text-primary border-primary")}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setAuditPanelOpen(true)}
          title="Аудит всех цен"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Период</span>
                  <TableColumnFilter
                    title="Период"
                    options={getUniqueOptions("date")}
                    selectedValues={columnFilters["date"] || []}
                    onUpdate={(values) => handleFilterUpdate("date", values)}
                    dataTestId="filter-date"
                  />
                </div>
              </TableHead>
              <TableHead className="w-[80px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Тип</span>
                  <TableColumnFilter
                    title="Тип"
                    options={[
                      { label: "ОПТ", value: COUNTERPARTY_TYPE.WHOLESALE },
                      { label: "Заправка ВС", value: COUNTERPARTY_TYPE.REFUELING },
                    ]}
                    selectedValues={columnFilters["counterpartyType"] || []}
                    onUpdate={(values) => handleFilterUpdate("counterpartyType", values)}
                    dataTestId="filter-type"
                  />
                </div>
              </TableHead>
              <TableHead className="w-[80px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Роль</span>
                  <TableColumnFilter
                    title="Роль"
                    options={[
                      { label: "Поставщик", value: COUNTERPARTY_ROLE.SUPPLIER },
                      { label: "Покупатель", value: COUNTERPARTY_ROLE.BUYER },
                    ]}
                    selectedValues={columnFilters["counterpartyRole"] || []}
                    onUpdate={(values) => handleFilterUpdate("counterpartyRole", values)}
                    dataTestId="filter-role"
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-1">
                  <span>Контрагент</span>
                  <TableColumnFilter
                    title="Контрагент"
                    options={getUniqueOptions("counterpartyId")}
                    selectedValues={columnFilters["counterpartyId"] || []}
                    onUpdate={(values) => handleFilterUpdate("counterpartyId", values)}
                    dataTestId="filter-counterparty"
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-1">
                  <span>Базис</span>
                  <TableColumnFilter
                    title="Базис"
                    options={getUniqueOptions("basis")}
                    selectedValues={columnFilters["basis"] || []}
                    onUpdate={(values) => handleFilterUpdate("basis", values)}
                    dataTestId="filter-basis"
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center justify-between gap-1">
                  <span>Продукт</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={getUniqueOptions("productType")}
                    selectedValues={columnFilters["productType"] || []}
                    onUpdate={(values) => handleFilterUpdate("productType", values)}
                    dataTestId="filter-product"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right w-[100px]">Цена (₽/кг)</TableHead>
              <TableHead className="text-right w-[100px]">Объем</TableHead>
              <TableHead className="text-right w-[100px]">Выборка</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-8 text-muted-foreground"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((price) => {
                const isExpired =
                  price.dateTo && new Date(price.dateTo) < new Date();
                return (
                  <TableRow
                    key={price.id}
                    data-testid={`row-price-${price.id}`}
                    className={isExpired ? "opacity-60" : ""}
                  >
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(price.dateFrom)} -{" "}
                      <span className={isExpired ? "text-red-400/70" : ""}>
                        {formatDate(price.dateTo)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center">
                            {price.counterpartyType ===
                            COUNTERPARTY_TYPE.WHOLESALE ? (
                              <Package className="h-5 w-5 text-blue-500/70" />
                            ) : (
                              <Plane className="h-5 w-5 text-purple-500/70" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {price.counterpartyType ===
                          COUNTERPARTY_TYPE.WHOLESALE
                            ? "ОПТ"
                            : "Заправка ВС"}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center">
                            {price.counterpartyRole ===
                            COUNTERPARTY_ROLE.SUPPLIER ? (
                              <TruckIcon className="h-5 w-5 text-green-500/70" />
                            ) : (
                              <ShoppingCart className="h-5 w-5 text-orange-500/70" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER
                            ? "Поставщик"
                            : "Покупатель"}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {getContractorName(
                        price.counterpartyId,
                        price.counterpartyType,
                        price.counterpartyRole,
                      )}
                    </TableCell>
                    <TableCell>{price.basis || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          price.productType === PRODUCT_TYPE.KEROSENE
                            ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"
                            : price.productType === PRODUCT_TYPE.PVKJ
                              ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30"
                              : price.productType === PRODUCT_TYPE.SERVICE
                                ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/30 dark:border-green-800/30"
                                : price.productType === PRODUCT_TYPE.AGENT
                                  ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/30 dark:border-orange-800/30"
                                  : price.productType === PRODUCT_TYPE.STORAGE
                                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/30 dark:border-amber-800/30"
                                    : ""
                        }
                      >
                        {getProductTypeLabel(price.productType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {getPriceDisplay(price.priceValues)}
                    </TableCell>
                    <TableCell className="text-right">
                      {price.volume ? `${formatNumber(price.volume)} кг` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>
                          {price.soldVolume && parseFloat(price.soldVolume) > 0
                            ? `${formatNumber(price.soldVolume)} кг`
                            : "—"}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() =>
                                selectionCheck.calculateForPrice.mutate(price)
                              }
                              disabled={
                                selectionCheck.calculatingPriceId === price.id
                              }
                              data-testid={`button-calc-selection-${price.id}`}
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${selectionCheck.calculatingPriceId === price.id ? "animate-spin" : ""}`}
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Пересчитать выборку</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => onEdit(price),
                            permission: { module: "prices", action: "edit" },
                          },
                          {
                            id: "notes",
                            label: "Примечания",
                            icon: StickyNote,
                            onClick: () => {
                              setSelectedPrice(price);
                              setNotesDialogOpen(true);
                            },
                            condition: !!price.notes,
                          },
                          {
                            id: "contract",
                            label: "Договор",
                            icon: FileText,
                            onClick: () => {
                              setSelectedPrice(price);
                              setContractDialogOpen(true);
                            },
                            condition: !!price.contractNumber,
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            onClick: () => {
                              setPriceToDelete(price);
                              setDeleteDialogOpen(true);
                            },
                            variant: "destructive" as const,
                            permission: { module: "prices", action: "delete" },
                            separatorAfter: true,
                          },
                        ]}
                        audit={{
                          entityType: "prices",
                          entityId: price.id,
                          entityName: `Цена для ${getContractorName(price.counterpartyId, price.counterpartyType, price.counterpartyRole)}`,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (priceToDelete) {
            deleteMutation.mutate(priceToDelete.id);
          }
          setDeleteDialogOpen(false);
          setPriceToDelete(null);
        }}
        title="Удалить цену?"
        description="Вы уверены, что хотите удалить эту цену? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечания</DialogTitle>
            <DialogDescription>
              Дополнительная информация о цене
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm whitespace-pre-wrap">
              {selectedPrice?.notes}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Договор</DialogTitle>
            <DialogDescription>Информация о договоре</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              Номер договора:{" "}
              <span className="font-medium">
                {selectedPrice?.contractNumber}
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="prices"
        entityId=""
        entityName="Все цены (включая удаленные)"
      />
    </div>
  );
}
