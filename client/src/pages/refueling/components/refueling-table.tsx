import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Warehouse,
  MoreVertical,
  FileText,
  AlertCircle,
  History,
  Copy,
} from "lucide-react";
import { AuditHistoryButton } from "@/components/audit-history-button";
import {
  EntityActionsMenu,
  EntityAction,
} from "@/components/entity-actions-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  formatNumber,
  formatNumberForTable,
  formatCurrencyForTable,
  getProductLabel,
} from "../utils";
import { useRefuelingTable } from "../hooks/use-refueling-table";
import { PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";

interface RefuelingDealActionsProps {
  deal: any;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

function RefuelingDealActions({
  deal,
  onEdit,
  onCopy,
  onDelete,
}: RefuelingDealActionsProps) {
  const actions: EntityAction[] = [
    {
      id: "copy",
      label: "Создать копию",
      icon: Copy,
      onClick: onCopy,
      permission: { module: "refueling", action: "create" },
    },
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: "refueling", action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: "refueling", action: "delete" },
      separatorAfter: true,
    },
  ];

  return (
    <EntityActionsMenu
      actions={actions}
      audit={{
        entityType: "aircraft_refueling",
        entityId: deal.id,
        entityName: `Заправка от ${new Date(deal.refuelingDate).toLocaleDateString("ru-RU")}`,
      }}
    />
  );
}

interface RefuelingTableProps {
  onEdit: (refueling: any) => void;
  onCopy: (refueling: any) => void;
  onDelete?: () => void;
}

export function RefuelingTable({ onEdit, onCopy, onDelete }: RefuelingTableProps) {
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const { hasPermission } = useAuth();
  const {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    refuelingDeals,
    isLoading,
    deleteMutation,
    handleDelete,
  } = useRefuelingTable();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedDealNotes, setSelectedDealNotes] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, setSearch, setPage]);

  useEffect(() => {
    if (searchInputRef.current && searchInput) {
      const input = searchInputRef.current;
      input.focus();
      input.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current,
      );
    }
  }, [refuelingDeals]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const allDeals = refuelingDeals?.data || [];
  const filteredDeals =
    productTypeFilter === "all"
      ? allDeals
      : allDeals.filter((deal) => deal.productType === productTypeFilter);

  const deals = filteredDeals;
  const total = filteredDeals.length;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              cursorPositionRef.current = e.target.selectionStart || 0;
            }}
            className="pl-9"
            data-testid="input-search-refueling"
          />
        </div>
        <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Тип продукта" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все продукты</SelectItem>
            <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
            <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
            <SelectItem value={PRODUCT_TYPE.SERVICE}>
              Услуга заправки
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => setDeletedDealsAuditOpen(true)}
          title="Аудит всех заправок"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton module="refueling" />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold">Дата</TableHead>
              <TableHead className="text-sm font-semibold">Продукт</TableHead>
              <TableHead className="text-sm font-semibold">Борт</TableHead>
              <TableHead className="text-sm font-semibold">Поставщик</TableHead>
              <TableHead className="text-sm font-semibold">
                Покупатель
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                КГ
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                Цена пок.
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                Покупка
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                Цена прод.
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                Продажа
              </TableHead>
              <TableHead className="text-right text-sm font-semibold">
                Прибыль
              </TableHead>
              <TableHead className="w-[100px] text-right text-sm font-semibold">
                Действия
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center py-8 text-muted-foreground text-sm"
                >
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow 
                  key={deal.id}
                  className={deal.isDraft ? "bg-muted/70 opacity-60 border-2 border-orange-200" : ""}
                >
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(deal.refuelingDate)}</span>
                      {deal.isDraft && (
                        <Badge
                          variant="outline"
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        >
                          Черновик
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge
                      variant="outline"
                      className={
                        deal.productType === PRODUCT_TYPE.KEROSENE
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"
                          : deal.productType === PRODUCT_TYPE.PVKJ
                            ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30"
                            : ""
                      }
                    >
                      {getProductLabel(deal.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {deal.aircraftNumber || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <TooltipProvider>
                      <div className="flex items-center gap-1.5">
                        <span>{deal.supplier?.name || "Не указан"}</span>
                        {deal.supplier?.isWarehouse && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Warehouse className="h-4 w-4 text-sky-400 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Склад</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-sm">
                    {deal.buyer?.name || "Не указан"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    <TooltipProvider>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{formatNumberForTable(deal.quantityKg)}</span>
                        {deal.isApproxVolume && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-red-300 flex-shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Примерный объем</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <div className="flex items-center justify-end gap-1">
                      {deal.purchasePrice
                        ? Number(deal.purchasePrice).toFixed(4)
                        : "-"}
                      {deal.purchasePriceModified && (
                        <span
                          className="text-orange-500"
                          title="Цена закупки была автоматически пересчитана"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrencyForTable(deal.purchaseAmount)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(deal.salePrice)} ₽/кг
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrencyForTable(deal.saleAmount)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-sm">
                    {formatCurrencyForTable(deal.profit)}
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-2 py-3">
                    <RefuelingDealActions
                      deal={deal}
                      onEdit={() => onEdit(deal)}
                      onCopy={() => onCopy(deal)}
                      onDelete={() => {
                        setDealToDelete(deal);
                        setDeleteDialogOpen(true);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
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
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (dealToDelete) {
            handleDelete(dealToDelete.id);
            onDelete?.();
          }
          setDeleteDialogOpen(false);
          setDealToDelete(null);
        }}
        title="Удалить заправку?"
        description="Вы уверены, что хотите удалить эту заправку? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечания к заправке</DialogTitle>
            <DialogDescription>
              {selectedDealNotes ? selectedDealNotes : "Нет примечаний"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="aircraft_refueling"
        entityId=""
        entityName="Все заправки ВС (включая удаленные)"
      />
    </div>
  );
}
