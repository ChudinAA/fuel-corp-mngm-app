import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pencil,
  Trash2,
  FileText,
  Copy,
  Search,
  Filter,
  History,
  Loader2,
  AlertTriangle,
  Plus,
  Globe,
} from "lucide-react";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportButton } from "@/components/export/export-button";
import { formatNumber, formatDate } from "../utils";
import type { MovementTableProps } from "../types";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { TableColumnFilter } from "@/components/ui/table-column-filter";
import { useMovementTable } from "../hooks/use-movement-table";
import { cn } from "@/lib/utils";
import { ProductTypeBadge } from "@/components/product-type-badge";

const formatNumberWithK = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return formatNumber(num);
};

function getServiceTypeShort(serviceType: string): string {
  if (serviceType === "royalty_per_ton") return "Р/т";
  if (serviceType === "percent_of_amount") return "%";
  if (serviceType === "fixed") return "Ф";
  return serviceType;
}

function getServiceTypeLabel(serviceType: string): string {
  if (serviceType === "royalty_per_ton") return "Роялти/т";
  if (serviceType === "percent_of_amount") return "% от суммы";
  if (serviceType === "fixed") return "Фикс.";
  return serviceType;
}

export function MovementTable({
  onEdit,
  onDelete,
  onShowHistory,
  onCreate,
}: Omit<MovementTableProps, "data" | "isLoading" | "isDeleting"> & {
  onShowHistory: () => void;
  onCreate?: () => void;
}) {
  const { hasPermission } = useAuth();
  
  const {
    search,
    setSearch,
    movements,
    total,
    isLoading,
    columnFilters,
    setColumnFilters,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMovementTable();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  const getProductLabel = (productType: string) => {
    if (productType === PRODUCT_TYPE.PVKJ) return "ПВКЖ";
    return "Керосин";
  };

  const getUniqueOptions = (key: string) => {
    const data = movements || [];
    const values = new Map<string, string>();
    data.forEach((item: any) => {
      if (key === "date") {
        const val = formatDate(item.movementDate);
        values.set(val, val);
      } else if (key === "type") {
        const label =
          item.movementType === MOVEMENT_TYPE.SUPPLY ? "Покупка" : "Внутреннее";
        values.set(label, item.movementType);
      } else if (key === "product") {
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
  };

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 md:px-6 pb-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const data = movements || [];

  return (
    <div className="space-y-4 px-4 md:px-6 pb-5">
      <div className="flex items-center gap-2 flex-wrap">
        {onCreate && hasPermission("movement", "create") && (
          <Button onClick={onCreate} data-testid="button-add-movement">
            <Plus className="mr-2 h-4 w-4" />
            Новое перемещение
          </Button>
        )}
        <div className="relative flex-1 min-w-[160px] max-w-sm">
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
          className={cn(
            Object.values(columnFilters).some((v) => v.length > 0) &&
              "text-primary border-primary",
          )}
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={onShowHistory}
          title="Аудит всех перемещений"
        >
          <History className="h-4 w-4 mr-2" />
          История
        </Button>
        <ExportButton moduleName="movement" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-xs font-semibold px-1 py-1">
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
              <TableHead className="w-[85px] text-xs font-semibold px-1 py-1">
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
              <TableHead className="w-[70px] text-xs font-semibold px-1 py-1">
                <div className="flex items-center justify-between gap-0.5">
                  <span>Прод.</span>
                  <TableColumnFilter
                    title="Продукт"
                    options={getUniqueOptions("product")}
                    selectedValues={columnFilters["product"] || []}
                    onUpdate={(values) => handleFilterUpdate("product", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold px-1 py-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">Откуда</span>
                  <TableColumnFilter
                    title="Откуда"
                    options={getUniqueOptions("fromName")}
                    selectedValues={columnFilters["from"] || []}
                    onUpdate={(values) => handleFilterUpdate("from", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold px-1 py-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate max-w-[70px]">Куда</span>
                  <TableColumnFilter
                    title="Куда"
                    options={getUniqueOptions("toName")}
                    selectedValues={columnFilters["to"] || []}
                    onUpdate={(values) => handleFilterUpdate("to", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-right w-[60px] text-xs font-semibold px-1 py-1">
                КГ
              </TableHead>
              <TableHead className="text-right w-[70px] text-xs font-semibold px-1 py-1 leading-tight">
                Цена
              </TableHead>
              <TableHead className="text-right w-[75px] text-xs font-semibold px-1 py-1 leading-tight">
                Сумма
              </TableHead>
              <TableHead className="text-xs font-semibold px-1 py-1">
                <div className="flex items-center justify-between gap-0.5">
                  <span className="truncate max-w-[65px]">Перевозчик</span>
                  <TableColumnFilter
                    title="Перевозчик"
                    options={getUniqueOptions("carrierName")}
                    selectedValues={columnFilters["carrier"] || []}
                    onUpdate={(values) => handleFilterUpdate("carrier", values)}
                  />
                </div>
              </TableHead>
              <TableHead className="text-right w-[65px] text-xs font-semibold px-1 py-1">
                Дост.
              </TableHead>
              <TableHead className="text-right w-[65px] text-xs font-semibold px-1 py-1">
                Хран.
              </TableHead>
              <TableHead className="text-right w-[70px] text-xs font-semibold px-1 py-1">
                Услуги
              </TableHead>
              <TableHead className="text-right w-[70px] text-xs font-semibold px-1 py-1">
                Себест.
              </TableHead>
              <TableHead className="w-[10px] px-1 py-1 sticky right-0 bg-background z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={14}
                  className="text-center py-8 text-muted-foreground text-xs"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any) => {
                const quantityKg = parseFloat(item.quantityKg || "0");
                const purchasePrice = item.purchasePrice
                  ? parseFloat(item.purchasePrice)
                  : null;
                const purchaseAmount =
                  purchasePrice && quantityKg > 0
                    ? purchasePrice * quantityKg
                    : 0;
                const deliveryCost = item.deliveryCost
                  ? parseFloat(item.deliveryCost)
                  : 0;
                const storageCost = parseFloat(item.storageCost || "0");
                const warehouseServicesCost = item.warehouseServicesCost
                  ? parseFloat(item.warehouseServicesCost)
                  : null;
                const costPerKg = item.costPerKg
                  ? parseFloat(item.costPerKg)
                  : 0;
                const serviceTypes: Array<{ serviceType: string; serviceValue: string }> =
                  item.warehouseServiceTypes || [];

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      item.isDraft &&
                        "bg-muted/70 opacity-60 border-2 border-orange-200",
                    )}
                  >
                    <TableCell className="text-[10px] py-1.5 px-1 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {formatDate(item.movementDate)}
                        {item.isDraft && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-yellow-100 text-yellow-800 border-yellow-200"
                          >
                            Черновик
                          </Badge>
                        )}
                        {item.fromExchange && (
                          <Badge
                            variant="secondary"
                            className="w-fit text-[9px] h-4 px-1 bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                          >
                            Биржа
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        {item.movementType === MOVEMENT_TYPE.SUPPLY
                          ? "Покупка"
                          : "Внутр."}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 px-1">
                      <ProductTypeBadge
                        type={item.productType || PRODUCT_TYPE.KEROSENE}
                      />
                    </TableCell>
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px]">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{item.fromName || "—"}</span>
                        {item.fromIsExport && (
                          <Globe
                            className="h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400"
                            title="Без НДС (экспорт)"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px]">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="truncate">{item.toName || "—"}</span>
                        {item.toIsExport && (
                          <Globe
                            className="h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400"
                            title="Без НДС (экспорт)"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs py-1.5 px-1">
                      {formatNumberWithK(item.quantityKg)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs py-1.5 px-1">
                      {purchasePrice !== null
                        ? formatNumber(purchasePrice)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {purchaseAmount > 0
                        ? formatNumberWithK(purchaseAmount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs py-1.5 px-1 max-w-[100px]">
                      {item.carrierName ? (
                        <span className="truncate block">{item.carrierName}</span>
                      ) : item.movementType === MOVEMENT_TYPE.SUPPLY && !item.isDraft && !item.fromExchange ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-medium">Не указан</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatNumberWithK(deliveryCost)}
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {formatNumberWithK(storageCost)}
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-1">
                      {warehouseServicesCost !== null && warehouseServicesCost > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-end gap-0.5 cursor-default">
                                <span>{formatNumberWithK(warehouseServicesCost)}</span>
                                {serviceTypes.length > 0 && (
                                  <div className="flex gap-0.5 flex-wrap justify-end">
                                    {serviceTypes.map((svc, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="text-[9px] px-1 py-0 h-3.5 font-normal leading-none"
                                      >
                                        {getServiceTypeShort(svc.serviceType)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            {serviceTypes.length > 0 && (
                              <TooltipContent side="left" className="text-xs">
                                <div className="space-y-0.5">
                                  {serviceTypes.map((svc, idx) => (
                                    <div key={idx}>
                                      {getServiceTypeLabel(svc.serviceType)}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs py-1.5 px-1">
                      {formatNumber(costPerKg)}
                    </TableCell>
                    <TableCell className="py-1.5 px-1 sticky right-0 bg-background">
                      {item.fromExchange ? (
                        <div className="w-8" />
                      ) : (
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
                              onClick: () =>
                                onEdit({ ...item, id: undefined } as any),
                              permission: {
                                module: "movement",
                                action: "create",
                              },
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
                              permission: {
                                module: "movement",
                                action: "delete",
                              },
                              separatorAfter: true,
                            },
                          ]}
                          audit={{
                            entityType: "movement",
                            entityId: item.id,
                            entityName: `Перемещение от ${formatDate(item.movementDate)}`,
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full max-w-xs gap-2"
            data-testid="button-load-more-movement"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              "Загрузить еще"
            )}
          </Button>
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
            <DialogDescription className="whitespace-pre-wrap">
              {selectedNotes}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
