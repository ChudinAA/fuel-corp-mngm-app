
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Pencil, Trash2 } from "lucide-react";
import type { DeliveryCost } from "@shared/schema";
import { formatNumber } from "../utils";

interface DeliveryTableProps {
  costs: DeliveryCost[];
  isLoading: boolean;
  getCarrierName: (carrierId: string) => string;
  onEdit: (cost: DeliveryCost) => void;
}

export function DeliveryTable({ costs, isLoading, getCarrierName, onEdit }: DeliveryTableProps) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/delivery-costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить тариф", variant: "destructive" });
    },
  });

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Перевозчик</TableHead>
            <TableHead>Маршрут</TableHead>
            <TableHead className="text-right">За кг (₽)</TableHead>
            <TableHead className="text-right">Расстояние (км)</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ))
          ) : costs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Нет тарифов для отображения
              </TableCell>
            </TableRow>
          ) : (
            costs.map((cost) => (
              <TableRow key={cost.id}>
                <TableCell>{getCarrierName(cost.carrierId)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{cost.fromLocation}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{cost.toLocation}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{formatNumber(cost.costPerKg)} ₽</TableCell>
                <TableCell className="text-right">{cost.distance ? formatNumber(cost.distance) : "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      data-testid={`button-edit-delivery-${cost.id}`}
                      onClick={() => onEdit(cost)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Вы уверены, что хотите удалить этот тариф?")) {
                          deleteMutation.mutate(cost.id);
                        }
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
  );
}
