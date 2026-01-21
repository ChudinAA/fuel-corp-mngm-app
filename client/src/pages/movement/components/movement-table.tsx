import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, FileText, Copy, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportButton } from "@/components/export/export-button";
import { formatNumber, formatDate } from "../utils";
import type { MovementTableProps } from "../types";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { useMovementTable } from "../hooks/use-movement-table";
import { cn } from "@/lib/utils";

const formatNumberWithK = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}к`;
  }
  return formatNumber(num);
};

export function MovementTable({ onEdit, onDelete }: Omit<MovementTableProps, 'data' | 'isLoading' | 'isDeleting'>) {
  const {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    movements,
    isLoading,
    columnFilters,
    setColumnFilters,
  } = useMovementTable();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch, setPage]);

  const getProductLabel = (productType: string) => {
    if (productType === PRODUCT_TYPE.PVKJ) return "ПВКЖ";
    return "Керосин";
  };

  const getUniqueOptions = (key: string) => {
    const data = (movements as any)?.data || [];
    const values = new Map<string, string>();
    data.forEach((item: any) => {
      if (key === 'date') {
        const val = formatDate(item.movementDate);
        values.set(val, val);
      } else if (key === 'type') {
        const label = item.movementType === MOVEMENT_TYPE.SUPPLY ? "Покупка" : "Внутреннее";
        values.set(label, item.movementType);
      } else if (key === 'product') {
        const label = getProductLabel(item.productType);
        values.set(label, item.productType);
      } else {
        const val = item[key];
        if (val) values.set(val, val);
      }
    });
    return Array.from(values.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  };

  const handleFilterUpdate = (columnId: string, values: string[]) => {
    setColumnFilters((prev) => ({ ...prev, [columnId]: values }));
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const total = (movements as any)?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const data = (movements as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Поиск..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setColumnFilters({})}
            disabled={Object.values(columnFilters).every((v) => v.length === 0)}
            title="Сбросить все фильтры"
            className={cn(Object.values(columnFilters).some((v) => v.length > 0) && "text-primary border-primary")}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <ExportButton module="movement" />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Дата</span>
                  <TableColumnFilter
                    title="Дата"
                    options={getUniqueOptions("date")}
                    selectedValues={columnFilters["date"] || []}
                    onUpdate={(values) => handleFilterUpdate("date", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[120px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Тип</span>
                  <TableColumnFilter
                    title="Тип"
                    options={getUniqueOptions("type")}
                    selectedValues={columnFilters["type"] || []}
                    onUpdate={(values) => handleFilterUpdate("type", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[110px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Продукт</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={getUniqueOptions("product")}
                    selectedValues={columnFilters["product"] || []}
                    onUpdate={(values) => handleFilterUpdate("product", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[160px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Откуда</span>
                  <TableColumnFilter
                    title="Откуда"
                    options={getUniqueOptions("fromName")}
                    selectedValues={columnFilters["from"] || []}
                    onUpdate={(values) => handleFilterUpdate("from", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[160px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Куда</span>
                  <TableColumnFilter
                    title="Куда"
                    options={getUniqueOptions("toName")}
                    selectedValues={columnFilters["to"] || []}
                    onUpdate={(values) => handleFilterUpdate("to", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-right w-[80px]">КГ</TableHead>
              <TableHead className="text-right w-[100px]">Цена покупки</TableHead>
              <TableHead className="text-right w-[130px]">Сумма покупки</TableHead>
              <TableHead className="w-[120px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Перевозчик</span>
                  <TableColumnFilter
                    title="Перевозчик"
                    options={getUniqueOptions("carrierName")}
                    selectedValues={columnFilters["carrier"] || []}
                    onUpdate={(values) => handleFilterUpdate("carrier", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-right w-[90px]">Доставка</TableHead>
              <TableHead className="text-right w-[90px]">Хранение</TableHead>
              <TableHead className="text-right w-[110px]">Себестоимость</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any) => {
                const quantityKg = parseFloat(item.quantityKg || "0");
                const purchasePrice = item.purchasePrice ? parseFloat(item.purchasePrice) : null;
                const purchaseAmount = purchasePrice && quantityKg > 0 ? purchasePrice * quantityKg : 0;
                const deliveryCost = item.deliveryCost ? parseFloat(item.deliveryCost) : 0;
                const storageCost = (parseFloat(item.totalCost || "0") - purchaseAmount - deliveryCost);
                const costPerKg = item.costPerKg ? parseFloat(item.costPerKg) : 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.movementDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.movementType === MOVEMENT_TYPE.SUPPLY ? "Покупка" : "Внутреннее"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={item.productType === PRODUCT_TYPE.PVKJ ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30' : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30'}>
                        {getProductLabel(item.productType || PRODUCT_TYPE.KEROSENE)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.fromName || "—"}</TableCell>
                    <TableCell>{item.toName || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumberWithK(item.quantityKg)}</TableCell>
                    <TableCell className="text-right">
                      {purchasePrice !== null ? `${formatNumber(purchasePrice)} ₽/кг` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {purchaseAmount > 0 ? formatNumberWithK(purchaseAmount) : "—"}
                    </TableCell>
                    <TableCell>{item.carrierName || "—"}</TableCell>
                    <TableCell className="text-right">{formatNumberWithK(deliveryCost)}</TableCell>
                    <TableCell className="text-right">{formatNumberWithK(storageCost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(costPerKg)} ₽/кг</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => onEdit(item),
                            permission: { module: "movement", action: "edit" },
                          },
                          {
                            id: "copy",
                            label: "Создать копию",
                            icon: Copy,
                            onClick: () => onEdit({ ...item, id: undefined } as any),
                            permission: { module: "movement", action: "create" },
                          },
                          {
                            id: "notes",
                            label: "Примечание",
                            icon: FileText,
                            onClick: () => {
                              setSelectedNotes(item.notes || "");
                              setNotesDialogOpen(true);
                            },
                            condition: !!item.notes,
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            onClick: () => {
                              setItemToDelete(item);
                              setDeleteDialogOpen(true);
                            },
                            variant: "destructive" as const,
                            permission: { module: "movement", action: "delete" },
                            separatorAfter: true,
                          },
                        ]}
                        audit={{
                          entityType: "movement",
                          entityId: item.id,
                          entityName: `Перемещение от ${formatDate(item.movementDate)}`,
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {(page - 1) * pageSize + 1} -{" "}
            {Math.min(page * pageSize, total)} из {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (itemToDelete) onDelete(itemToDelete.id);
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить перемещение?"
        description="Вы уверены, что хотите удалить это перемещение? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечание</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">{selectedNotes}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}