
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
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { PaymentCalendarDialog } from "./payment-calendar-dialog";
import { AuditHistoryButton } from "@/components/audit-history-button";

interface PaymentItem {
  id: string;
  dueDate: string;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  category: string;
  counterparty: string | null;
  status: string;
  paidDate: string | null;
  paidAmount: string | null;
  isRecurring: boolean;
}

const statusLabels: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  overdue: "Просрочено",
  cancelled: "Отменено",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function PaymentCalendarTable() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [editingItem, setEditingItem] = useState<PaymentItem | null>(null);

  const { data: items, isLoading } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment-calendar"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/payment-calendar/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Ошибка при удалении платежа");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar/upcoming"] });
      toast({
        title: "Успешно",
        description: "Платеж удален",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/payment-calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "paid",
          paidDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (!response.ok) throw new Error("Ошибка при обновлении статуса");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar/upcoming"] });
      toast({
        title: "Успешно",
        description: "Платеж отмечен как оплаченный",
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
    return new Date(dateString).toLocaleDateString('ru-RU');
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
              <TableHead>Название</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.dueDate)}</TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.counterparty || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.category === 'payable' ? 'К оплате' : 'К получению'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[item.status]}>
                      {statusLabels[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <AuditHistoryButton
                        entityType="payment_calendar"
                        entityId={item.id}
                        entityName={item.title}
                        variant="ghost"
                        size="sm"
                      />
                      {item.status === 'pending' && hasPermission("finance", "edit") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsPaidMutation.mutate(item.id)}
                          title="Отметить как оплаченный"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {hasPermission("finance", "edit") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission("finance", "delete") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
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
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Нет данных
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingItem && (
        <PaymentCalendarDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          item={editingItem}
        />
      )}
    </>
  );
}
