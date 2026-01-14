
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import type { AircraftRefueling } from "@shared/schema";
import { PRODUCT_TYPES, PAGE_SIZE } from "./constants";
import { formatNumber, formatCurrency, formatDate } from "./utils";

interface RefuelingTableProps {
  data: AircraftRefueling[];
  total: number;
  page: number;
  search: string;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onEdit: (refueling: AircraftRefueling) => void;
}

export function RefuelingTable({
  data,
  total,
  page,
  search,
  isLoading,
  onPageChange,
  onSearchChange,
  onEdit,
}: RefuelingTableProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/refueling/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
      toast({ title: "Заправка удалена", description: "Запись о заправке успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const getProductLabel = (type: string) => {
    return PRODUCT_TYPES.find(t => t.value === type)?.label || type;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по заправкам..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-refueling"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Борт</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead className="text-right">КГ/Кол-во</TableHead>
              <TableHead className="text-right">Прибыль</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}><Skeleton className="h-12 w-full" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any) => (
                <TableRow key={item.id} className={item.isDraft ? "bg-muted/50 opacity-80" : ""}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(item.refuelingDate)}</span>
                      {item.isDraft && (
                        <Badge variant="outline" className="w-fit text-[10px] px-1 h-4 text-amber-600 border-amber-600 bg-amber-50">
                          Черновик
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getProductLabel(item.productType)}</Badge>
                  </TableCell>
                  <TableCell>{item.aircraftNumber || "—"}</TableCell>
                  <TableCell>{item.supplierId}</TableCell>
                  <TableCell>{item.buyerId}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(item.profit)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        data-testid={`button-edit-refueling-${item.id}`}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setItemToDelete({ id: item.id });
                          setDeleteDialogOpen(true);
                        }}
                        disabled={deleteMutation.isPending}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} из {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
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
              onClick={() => onPageChange(page + 1)}
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
          if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.id);
          }
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить заправку?"
        description="Вы уверены, что хотите удалить эту заправку?"
      />
    </div>
  );
}
