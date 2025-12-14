
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, Pencil, Trash2, RefreshCw, Package, Plane, TruckIcon, ShoppingCart, FileText, StickyNote } from "lucide-react";
import type { Price, Supplier, Customer } from "@shared/schema";
import type { PricesTableProps } from "../types";
import { formatNumber, formatDate, getPriceDisplay, getProductTypeLabel } from "../utils";
import { usePriceSelection } from "../hooks/use-price-selection";

export function PricesTable({ dealTypeFilter, roleFilter, productTypeFilter, onEdit }: PricesTableProps) {
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<Price | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);
  const { toast } = useToast();

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
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
    if (role === "buyer") {
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
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по базису или контрагенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Период</TableHead>
              <TableHead className="w-[60px]">Тип</TableHead>
              <TableHead className="w-[60px]">Роль</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Базис</TableHead>
              <TableHead>Продукт</TableHead>
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
                          {price.counterpartyType === "wholesale" ? (
                            <Package className="h-5 w-5 text-blue-500/70" />
                          ) : (
                            <Plane className="h-5 w-5 text-purple-500/70" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {price.counterpartyType === "wholesale" ? "ОПТ" : "Заправка ВС"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center">
                          {price.counterpartyRole === "supplier" ? (
                            <TruckIcon className="h-5 w-5 text-green-500/70" />
                          ) : (
                            <ShoppingCart className="h-5 w-5 text-orange-500/70" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {price.counterpartyRole === "supplier" ? "Поставщик" : "Покупатель"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{getContractorName(price.counterpartyId, price.counterpartyType, price.counterpartyRole)}</TableCell>
                  <TableCell>{price.basis || "—"}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        price.productType === "kerosine" ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30" :
                        price.productType === "pvkj" ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30" :
                        price.productType === "service" ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/30 dark:border-green-800/30" :
                        price.productType === "agent" ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/30 dark:border-orange-800/30" :
                        price.productType === "storage" ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/30 dark:border-amber-800/30" :
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-price-${price.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(price)} data-testid={`button-edit-price-${price.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Редактировать
                        </DropdownMenuItem>
                        {price.notes && (
                          <DropdownMenuItem onClick={() => {
                            setSelectedPrice(price);
                            setNotesDialogOpen(true);
                          }}>
                            <StickyNote className="mr-2 h-4 w-4" />
                            Примечания
                          </DropdownMenuItem>
                        )}
                        {price.contractNumber && (
                          <DropdownMenuItem onClick={() => {
                            setSelectedPrice(price);
                            setContractDialogOpen(true);
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Договор
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setPriceToDelete(price);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-destructive"
                          data-testid={`button-delete-price-${price.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
    </div>
  );
}
