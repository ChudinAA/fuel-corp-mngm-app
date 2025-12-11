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
  AlertTriangle, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Warehouse,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumberForTable, formatCurrencyForTable } from "../utils";
import { useOptTable } from "../hooks/use-opt-table";

interface OptTableProps {
  onEdit: (opt: any) => void;
  onDelete?: () => void;
}

export function OptTable({ onEdit, onDelete }: OptTableProps) {
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
  } = useOptTable();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);

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
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead className="text-right">КГ</TableHead>
              <TableHead className="text-right">Цена пок.</TableHead>
              <TableHead className="text-right">Покупка</TableHead>
              <TableHead className="text-right">Цена прод.</TableHead>
              <TableHead className="text-right">Продажа</TableHead>
              <TableHead>Место доставки</TableHead>
              <TableHead>Перевозчик</TableHead>
              <TableHead className="text-right">Доставка</TableHead>
              <TableHead className="text-right">Прибыль</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>{formatDate(deal.dealDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {deal.supplier?.isWarehouse && (
                        <Warehouse className="h-4 w-4 text-muted-foreground flex-shrink-0" title="Склад" />
                      )}
                      <span>{deal.supplier?.name || 'Не указан'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{deal.buyer?.name || 'Не указан'}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumberForTable(deal.quantityKg)}</TableCell>
                  <TableCell className="text-right">{formatNumberForTable(deal.purchasePrice)} ₽/кг</TableCell>
                  <TableCell className="text-right">{formatCurrencyForTable(deal.purchaseAmount)}</TableCell>
                  <TableCell className="text-right">{formatNumberForTable(deal.salePrice)} ₽/кг</TableCell>
                  <TableCell className="text-right">{formatCurrencyForTable(deal.saleAmount)}</TableCell>
                  <TableCell>{deal.deliveryLocation?.name || '—'}</TableCell>
                  <TableCell>{deal.carrier?.name || '—'}</TableCell>
                  <TableCell className="text-right">{deal.deliveryCost ? formatCurrencyForTable(deal.deliveryCost) : '—'}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrencyForTable(deal.profit)}</TableCell>
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
                          onClick={() => onEdit(deal)}
                          data-testid={`button-edit-opt-${deal.id}`}
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
                          data-testid={`button-delete-opt-${deal.id}`}
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
        title="Удалить сделку?"
        description="Вы уверены, что хотите удалить эту оптовую сделку? Это действие нельзя отменить."
      />
    </div>
  );
}