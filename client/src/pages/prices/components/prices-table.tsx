import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Pencil, Trash2, RefreshCw, Package, Plane, TruckIcon, ShoppingCart, FileText, StickyNote, History } from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import type { Price, Supplier, Customer } from "@shared/schema";
import type { PricesTableProps } from "../types";
import { COUNTERPARTY_ROLE } from "@shared/constants";
import { usePriceSelection } from "../hooks/use-price-selection";

export function PricesTable({ dealTypeFilter, roleFilter, productTypeFilter, onEdit }: PricesTableProps) {
  const [filters, setFilters] = useState({
    dateRange: { from: undefined as Date | undefined, to: undefined as Date | undefined },
    dealType: "all",
    role: "all",
    counterpartyId: "all",
    basis: "all",
    productType: "all",
  });

  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<Price | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices/list", {
      counterpartyType: filters.dealType !== "all" ? filters.dealType : (dealTypeFilter !== "all" ? dealTypeFilter : undefined),
      counterpartyRole: filters.role !== "all" ? filters.role : (roleFilter !== "all" ? roleFilter : undefined),
      productType: filters.productType !== "all" ? filters.productType : (productTypeFilter !== "all" ? productTypeFilter : undefined),
      counterpartyId: filters.counterpartyId !== "all" ? filters.counterpartyId : undefined,
      basis: filters.basis !== "all" ? filters.basis : undefined,
      dateFrom: filters.dateRange.from?.toISOString(),
      dateTo: filters.dateRange.to?.toISOString(),
    }],
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
    return contractors?.find(c => c.id === id)?.name || `ID: ${id}`;
  };

  const filteredPrices = prices?.filter(p => {
    // Фильтр по типу сделки
    if (dealTypeFilter !== "all" && p.counterpartyType !== dealTypeFilter) {
      return false;
    }

    // Фильтр по роли
    if (roleFilter !== "all" && p.counterpartyRole !== roleFilter) {
      return false;
    }

    // Фильтр по типу продукта
    if (productTypeFilter !== "all" && p.productType !== productTypeFilter) {
      return false;
    }

    // Поиск
    if (search) {
      const searchLower = search.toLowerCase();
      const contractorName = getContractorName(p.counterpartyId, p.counterpartyType, p.counterpartyRole).toLowerCase();
      const basis = (p.basis || "").toLowerCase();
      if (!contractorName.includes(searchLower) && !basis.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Сортировка по дате создания (новые сверху)
    return new Date(b.dateTo).getTime() - new Date(a.dateTo).getTime();
  }) || [];

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
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск по базису или контрагенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
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
              <TableHead>
                <div className="flex items-center gap-2">
                  Период
                  <TableColumnFilter
                    type="date-range"
                    value={filters.dateRange}
                    onChange={(val) => setFilters(prev => ({ ...prev, dateRange: val }))}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[60px]">
                <div className="flex items-center gap-2">
                  Тип
                  <TableColumnFilter
                    type="select"
                    options={[
                      { label: "Все", value: "all" },
                      { label: "ОПТ", value: COUNTERPARTY_TYPE.WHOLESALE },
                      { label: "Заправка ВС", value: COUNTERPARTY_TYPE.REFUELING },
                    ]}
                    value={filters.dealType}
                    onChange={(val) => setFilters(prev => ({ ...prev, dealType: val }))}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[60px]">
                <div className="flex items-center gap-2">
                  Роль
                  <TableColumnFilter
                    type="select"
                    options={[
                      { label: "Все", value: "all" },
                      { label: "Поставщик", value: COUNTERPARTY_ROLE.SUPPLIER },
                      { label: "Покупатель", value: COUNTERPARTY_ROLE.BUYER },
                    ]}
                    value={filters.role}
                    onChange={(val) => setFilters(prev => ({ ...prev, role: val }))}
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Контрагент
                  <TableColumnFilter
                    type="select"
                    options={[
                      { label: "Все", value: "all" },
                      ...(filters.role === COUNTERPARTY_ROLE.BUYER ? (customers || []) : (allContractors || [])).map(c => ({
                        label: c.name,
                        value: c.id
                      }))
                    ]}
                    value={filters.counterpartyId}
                    onChange={(val) => setFilters(prev => ({ ...prev, counterpartyId: val }))}
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Базис
                  <TableColumnFilter
                    type="select"
                    options={[
                      { label: "Все", value: "all" },
                      ...Array.from(new Set(prices?.map(p => p.basis).filter(Boolean) || [])).map(b => ({
                        label: b!,
                        value: b!
                      }))
                    ]}
                    value={filters.basis}
                    onChange={(val) => setFilters(prev => ({ ...prev, basis: val }))}
                  />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  Продукт
                  <TableColumnFilter
                    type="select"
                    options={[
                      { label: "Все", value: "all" },
                      { label: "Керосин", value: PRODUCT_TYPE.KEROSENE },
                      { label: "Услуги", value: PRODUCT_TYPE.SERVICE },
                      { label: "ПВКЖ", value: PRODUCT_TYPE.PVKJ },
                      { label: "Агентское", value: PRODUCT_TYPE.AGENT },
                      { label: "Хранение", value: PRODUCT_TYPE.STORAGE },
                    ]}
                    value={filters.productType}
                    onChange={(val) => setFilters(prev => ({ ...prev, productType: val }))}
                  />
                </div>
              </TableHead>
              <TableHead className="text-right">Цена (₽/кг)</TableHead>
              <TableHead className="text-right">Объем</TableHead>
              <TableHead className="text-right">Выборка</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Нет данных</TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((price) => {
                const isExpired = price.dateTo && new Date(price.dateTo) < new Date();
                return (
                <TableRow key={price.id} data-testid={`row-price-${price.id}`} className={isExpired ? "opacity-60" : ""}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(price.dateFrom)} - <span className={isExpired ? "text-red-400/70" : ""}>{formatDate(price.dateTo)}</span>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center">
                          {price.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE ? (
                            <Package className="h-5 w-5 text-blue-500/70" />
                          ) : (
                            <Plane className="h-5 w-5 text-purple-500/70" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {price.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE ? "ОПТ" : "Заправка ВС"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center">
                          {price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER ? (
                            <TruckIcon className="h-5 w-5 text-green-500/70" />
                          ) : (
                            <ShoppingCart className="h-5 w-5 text-orange-500/70" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {price.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER ? "Поставщик" : "Покупатель"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{getContractorName(price.counterpartyId, price.counterpartyType, price.counterpartyRole)}</TableCell>
                  <TableCell>{price.basis || "—"}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        price.productType === PRODUCT_TYPE.KEROSENE ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30" :
                        price.productType === PRODUCT_TYPE.PVKJ ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30" :
                        price.productType === PRODUCT_TYPE.SERVICE ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/30 dark:border-green-800/30" :
                        price.productType === PRODUCT_TYPE.AGENT ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/30 dark:border-orange-800/30" :
                        price.productType === PRODUCT_TYPE.STORAGE ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/30 dark:border-amber-800/30" :
                        ""
                      }
                    >
                      {getProductTypeLabel(price.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{getPriceDisplay(price.priceValues)}</TableCell>
                  <TableCell className="text-right">{price.volume ? `${formatNumber(price.volume)} кг` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{price.soldVolume && parseFloat(price.soldVolume) > 0 ? `${formatNumber(price.soldVolume)} кг` : "—"}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => selectionCheck.calculateForPrice.mutate(price)}
                            disabled={selectionCheck.calculatingPriceId === price.id}
                            data-testid={`button-calc-selection-${price.id}`}
                          >
                            <RefreshCw className={`h-3 w-3 ${selectionCheck.calculatingPriceId === price.id ? "animate-spin" : ""}`} />
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
            <DialogDescription>Дополнительная информация о цене</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm whitespace-pre-wrap">{selectedPrice?.notes}</p>
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
            <p className="text-sm">Номер договора: <span className="font-medium">{selectedPrice?.contractNumber}</span></p>
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