import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  History
} from "lucide-react";
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
import { formatNumberForTable, formatCurrencyForTable } from "../utils";
import { useOptTable } from "../hooks/use-opt-table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { ExportButton } from "@/components/export/export-button";

interface OptTableProps {
  onEdit: (opt: any) => void;
  onDelete?: () => void;
  onAdd?: () => void; // Added onAdd prop for consistency with the change snippet
}

interface OptDealActionsProps {
  deal: any;
  onEdit: () => void;
  onDelete: () => void;
  onShowNotes?: () => void;
}

function OptDealActions({ deal, onEdit, onDelete, onShowNotes }: OptDealActionsProps) {
  const actions: EntityAction[] = [
    ...(deal.notes && onShowNotes
      ? [
          {
            id: "notes",
            label: "Примечания",
            icon: FileText,
            onClick: onShowNotes,
          },
        ]
      : []),
    {
      id: "edit",
      label: "Редактировать",
      icon: Pencil,
      onClick: onEdit,
      permission: { module: "opt", action: "edit" },
    },
    {
      id: "delete",
      label: "Удалить",
      icon: Trash2,
      onClick: onDelete,
      variant: "destructive" as const,
      permission: { module: "opt", action: "delete" },
      separatorAfter: true,
    },
  ];

  return (
    <EntityActionsMenu
      actions={actions}
      audit={{
        entityType: "opt",
        entityId: deal.id,
        entityName: `Сделка от ${new Date(deal.dealDate).toLocaleDateString('ru-RU')}`,
      }}
    />
  );
}


export function OptTable({ onEdit, onDelete, onAdd }: OptTableProps) {
  const {
    page,
    setPage,
    search,
    setSearch,
    pageSize,
    optDeals,
    isLoading,
    deleteMutation,
    handleDelete,
    isDeletingId // Assuming isDeletingId is available from useOptTable for disabling delete buttons
  } = useOptTable();

  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedDealNotes, setSelectedDealNotes] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);
  const [deletedDealsAuditOpen, setDeletedDealsAuditOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset to first page when searching
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, setSearch, setPage]);

  // Restore focus and cursor position after data update
  useEffect(() => {
    if (searchInputRef.current && searchInput) {
      const input = searchInputRef.current;
      input.focus();
      input.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
    }
  }, [optDeals]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  const formatDateForAudit = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy HH:mm:ss", { locale: ru });
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

  const deals = optDeals?.data || [];
  const total = optDeals?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Поиск по поставщику, покупателю, базису..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              cursorPositionRef.current = e.target.selectionStart || 0;
            }}
            className="pl-9"
            data-testid="input-search-opt"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          disabled
          title="Фильтры скоро будут доступны"
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => setDeletedDealsAuditOpen(true)}
          title="Аудит всех сделок"
        >
          <History className="h-4 w-4 mr-2" />
          История изменений
        </Button>
        <ExportButton moduleName="opt" /> {/* Export button added here */}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold">Дата</TableHead>
              <TableHead className="text-sm font-semibold">Поставщик</TableHead>
              <TableHead className="text-sm font-semibold">Покупатель</TableHead>
              <TableHead className="text-right text-sm font-semibold">КГ</TableHead>
              <TableHead className="text-right text-sm font-semibold">Цена пок.</TableHead>
              <TableHead className="text-right text-sm font-semibold">Покупка</TableHead>
              <TableHead className="text-right text-sm font-semibold">Цена прод.</TableHead>
              <TableHead className="text-right text-sm font-semibold">Продажа</TableHead>
              <TableHead className="text-sm font-semibold">Место доставки</TableHead>
              <TableHead className="text-sm font-semibold">Перевозчик</TableHead>
              <TableHead className="text-right text-sm font-semibold">Доставка</TableHead>
              <TableHead className="text-right text-sm font-semibold">Прибыль</TableHead>
              <TableHead className="text-sm font-semibold">Стат</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground text-sm">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id} className={deal.isDraft ? "bg-muted/50 opacity-80" : ""}>
                  <TableCell className="text-xs">{formatDate(deal.dealDate)}</TableCell>
                  <TableCell className="text-sm">
                    <TooltipProvider>
                      <div className="flex items-center gap-1.5">
                        <span>{deal.supplier?.name || 'Не указан'}</span>
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
                  <TableCell className="text-sm">{deal.buyer?.name || 'Не указан'}</TableCell>
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
                      {deal.purchasePrice ? Number(deal.purchasePrice).toFixed(4) : "-"}
                      {deal.purchasePriceModified && (
                        <span className="text-orange-500" title="Цена закупки была автоматически пересчитана">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatCurrencyForTable(deal.purchaseAmount)}</TableCell>
                  <TableCell className="text-right text-sm">{formatNumberForTable(deal.salePrice)} ₽/кг</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrencyForTable(deal.saleAmount)}</TableCell>
                  <TableCell className="text-sm">{deal.deliveryLocation?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{deal.carrier?.name || '—'}</TableCell>
                  <TableCell className="text-right text-sm">{deal.deliveryCost ? formatCurrencyForTable(deal.deliveryCost) : '—'}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-sm">{formatCurrencyForTable(deal.profit)}</TableCell>
                  <TableCell className="text-sm">
                    {deal.isDraft ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Черн
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        Оф
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <OptDealActions
                      deal={deal}
                      onEdit={() => onEdit(deal)}
                      onDelete={() => {
                        setDealToDelete(deal);
                        setDeleteDialogOpen(true);
                      }}
                      onShowNotes={
                        deal.notes
                          ? () => {
                              setSelectedDealNotes(deal.notes || "");
                              setNotesDialogOpen(true);
                            }
                          : undefined
                      }
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
            Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}
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
        title="Удалить сделку?"
        description="Вы уверены, что хотите удалить эту оптовую сделку? Это действие нельзя отменить."
      />

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Примечания к сделке</DialogTitle>
            <DialogDescription>
              {selectedDealNotes ? selectedDealNotes : "Нет примечаний"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <AuditPanel
        open={deletedDealsAuditOpen}
        onOpenChange={setDeletedDealsAuditOpen}
        entityType="opt"
        entityId=""
        entityName="Все сделки ОПТ (включая удаленные)"
      />
    </div>
  );
}