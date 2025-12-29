
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { PriceCalculationDialog } from "./price-calculation-dialog";

interface PriceCalculation {
  id: string;
  name: string;
  productType: string;
  totalCost: string;
  sellingPrice: string;
  margin: string;
  marginPercentage: string;
  isTemplate: boolean;
  createdAt: string;
}

interface PriceCalculationTableProps {
  templateFilter?: boolean;
}

const productTypeLabels: Record<string, string> = {
  kerosene: "Керосин",
  pvkj: "ПВК-Ж",
  service: "Услуга",
};

export function PriceCalculationTable({ templateFilter }: PriceCalculationTableProps) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [editingCalculation, setEditingCalculation] = useState<PriceCalculation | null>(null);

  const { data: calculations, isLoading } = useQuery<PriceCalculation[]>({
    queryKey: ["/api/price-calculations", { isTemplate: templateFilter }],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/price-calculations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Ошибка при удалении расчета");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-calculations"] });
      toast({
        title: "Успешно",
        description: "Расчет удален",
      });
    },
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return <div className="text-center py-4">Загрузка...</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип продукта</TableHead>
              <TableHead className="text-right">Себестоимость</TableHead>
              <TableHead className="text-right">Цена продажи</TableHead>
              <TableHead className="text-right">Маржа</TableHead>
              <TableHead className="text-right">Маржа %</TableHead>
              <TableHead>Дата создания</TableHead>
              {hasPermission("finance", "edit") && <TableHead className="w-[100px]">Действия</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculations && calculations.length > 0 ? (
              calculations.map((calculation) => (
                <TableRow key={calculation.id}>
                  <TableCell className="font-medium">
                    {calculation.name}
                    {calculation.isTemplate && (
                      <Badge variant="secondary" className="ml-2">Шаблон</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {productTypeLabels[calculation.productType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(calculation.totalCost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(calculation.sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatCurrency(calculation.margin)}
                  </TableCell>
                  <TableCell className="text-right">
                    {parseFloat(calculation.marginPercentage).toFixed(2)}%
                  </TableCell>
                  <TableCell>{formatDate(calculation.createdAt)}</TableCell>
                  {hasPermission("finance", "edit") && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCalculation(calculation)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {hasPermission("finance", "delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(calculation.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingCalculation && (
        <PriceCalculationDialog
          open={!!editingCalculation}
          onOpenChange={(open) => !open && setEditingCalculation(null)}
          calculation={editingCalculation}
        />
      )}
    </>
  );
}
