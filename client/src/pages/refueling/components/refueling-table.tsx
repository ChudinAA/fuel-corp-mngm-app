
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber, formatCurrency, getProductLabel } from "../utils";
import { useRefuelingTable } from "../hooks/use-refueling-table";

interface RefuelingTableProps {
  onEdit: (refueling: any) => void;
  onDelete?: () => void;
  productTypeFilter?: string;
}

export function RefuelingTable({ onEdit, onDelete, productTypeFilter = "all" }: RefuelingTableProps) {
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
      input.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
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
  const filteredDeals = productTypeFilter === "all" 
    ? allDeals 
    : allDeals.filter(deal => deal.productType === productTypeFilter);
  
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
        <Button 
          variant="outline" 
          size="icon"
          disabled
          title="Фильтры скоро будут доступны"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-semibold">Дата</TableHead>
              <TableHead className="text-sm font-semibold">Продукт</TableHead>
              <TableHead className="text-sm font-semibold">Борт</TableHead>
              <TableHead className="text-sm font-semibold">Поставщик</TableHead>
              <TableHead className="text-sm font-semibold">Покупатель</TableHead>
              <TableHead className="text-right text-sm font-semibold">КГ</TableHead>
              <TableHead className="text-right text-sm font-semibold">Цена пок.</TableHead>
              <TableHead className="text-right text-sm font-semibold">Покупка</TableHead>
              <TableHead className="text-right text-sm font-semibold">Цена прод.</TableHead>
              <TableHead className="text-right text-sm font-semibold">Продажа</TableHead>
              <TableHead className="text-right text-sm font-semibold">Прибыль</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-sm">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="text-xs">{formatDate(deal.refuelingDate)}</TableCell>
                  <TableCell className="text-sm">
                    <Badge 
                      variant="outline"
                      className={
                        deal.productType === "kerosene" ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30" :
                        deal.productType === "pvkj" ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30" :
                        ""
                      }
                    >
                      {getProductLabel(deal.productType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{deal.aircraftNumber || '—'}</TableCell>
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
                        <span>{formatNumber(deal.quantityKg)}</span>
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
                  <TableCell className="text-right text-sm">{formatNumber(deal.purchasePrice)} ₽/кг</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(deal.purchaseAmount)}</TableCell>
                  <TableCell className="text-right text-sm">{formatNumber(deal.salePrice)} ₽/кг</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(deal.saleAmount)}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium text-sm">{formatCurrency(deal.profit)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDealNotes(deal.notes || "");
                            setNotesDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Примечания
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEdit(deal)}
                          data-testid={`button-edit-refueling-${deal.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDealToDelete(deal);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-destructive focus:text-destructive"
                          data-testid={`button-delete-refueling-${deal.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
    </div>
  );
}
