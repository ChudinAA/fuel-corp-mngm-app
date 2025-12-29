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
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CashflowDialog } from "./cashflow-dialog";
import { AuditHistoryButton } from "@/components/audit-history-button";

interface CashflowTransaction {
  id: string;
  transactionDate: string;
  category: string;
  subcategory: string | null;
  amount: string;
  currency: string;
  description: string | null;
  counterparty: string | null;
  paymentMethod: string | null;
  isPlanned: boolean;
  notes: string | null;
}

const categoryLabels: Record<string, string> = {
  income: "Поступление",
  expense: "Расход",
  transfer: "Перемещение",
};

const categoryColors: Record<string, string> = {
  income: "bg-green-100 text-green-800",
  expense: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
};

export function CashflowTable() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [editingTransaction, setEditingTransaction] = useState<CashflowTransaction | null>(null);

  const { data: transactions, isLoading } = useQuery<CashflowTransaction[]>({
    queryKey: ["/api/cashflow"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cashflow/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Ошибка при удалении транзакции");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/summary"] });
      toast({
        title: "Успешно",
        description: "Транзакция удалена",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить транзакцию",
        variant: "destructive",
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
              <TableHead>Дата</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Подкатегория</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{formatDate(transaction.transactionDate)}</TableCell>
                  <TableCell>
                    <Badge className={categoryColors[transaction.category]}>
                      {categoryLabels[transaction.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>{transaction.subcategory || "-"}</TableCell>
                  <TableCell>{transaction.counterparty || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {transaction.description || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell>
                    {transaction.isPlanned ? (
                      <Badge variant="outline">Планируемый</Badge>
                    ) : (
                      <Badge variant="default">Фактический</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <AuditHistoryButton
                        entityType="cashflow_transactions"
                        entityId={transaction.id}
                        entityName={transaction.description || "Транзакция"}
                        variant="ghost"
                        size="sm"
                      />
                      {hasPermission("finance", "edit") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTransaction(transaction)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission("finance", "delete") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(transaction.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingTransaction && (
        <CashflowDialog
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          transaction={editingTransaction}
        />
      )}
    </>
  );
}