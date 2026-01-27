import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber } from "../utils";
import type { RefuelingAbroadExtended } from "../types";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RefuelingAbroad, Supplier, Customer } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RefuelingAbroadTableProps {
  onEdit: (item: RefuelingAbroad) => void;
  onCopy: (item: RefuelingAbroad) => void;
}

export function RefuelingAbroadTable({ onEdit, onCopy }: RefuelingAbroadTableProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { data: items = [], isLoading } = useQuery<RefuelingAbroad[]>({
    queryKey: ["/api/refueling-abroad"],
  });
  
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/refueling-abroad/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling-abroad"] });
      toast({ title: "Запись удалена" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить запись",
        variant: "destructive",
      });
    },
  });
  
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || "—";
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || "—";
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Нет записей. Создайте первую заправку за рубежом.
      </div>
    );
  }
  
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            <TableHead>Аэропорт</TableHead>
            <TableHead>Борт</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead>Покупатель</TableHead>
            <TableHead className="text-right">Объем (кг)</TableHead>
            <TableHead className="text-right">Сумма (USD)</TableHead>
            <TableHead className="text-right">Прибыль (USD)</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-testid={`row-refueling-abroad-${item.id}`}>
              <TableCell>
                {new Date(item.refuelingDate).toLocaleDateString("ru-RU")}
              </TableCell>
              <TableCell className="font-mono">{item.airport || "—"}</TableCell>
              <TableCell>{item.aircraftNumber || "—"}</TableCell>
              <TableCell>{getSupplierName(item.supplierId)}</TableCell>
              <TableCell>{getCustomerName(item.buyerId)}</TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(item.quantityKg)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.saleAmountUsd, "USD")}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className={parseFloat(item.profitUsd || "0") < 0 ? "text-destructive" : "text-green-600"}>
                  {formatCurrency(item.profitUsd, "USD")}
                </span>
              </TableCell>
              <TableCell>
                {item.isDraft ? (
                  <Badge variant="secondary">Черновик</Badge>
                ) : (
                  <Badge variant="default">Проведен</Badge>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-actions-${item.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(item)} data-testid={`button-edit-${item.id}`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCopy(item)} data-testid={`button-copy-${item.id}`}>
                      <Copy className="mr-2 h-4 w-4" />
                      Копировать
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Запись будет удалена из системы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
