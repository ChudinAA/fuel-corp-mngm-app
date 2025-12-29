import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface PaymentItem {
  id?: string;
  dueDate: string;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  category: string;
  counterparty: string | null;
  status: string;
  isRecurring: boolean;
  notes: string | null;
}

interface PaymentCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PaymentItem;
}

export function PaymentCalendarDialog({ open, onOpenChange, item }: PaymentCalendarDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRecurring, setIsRecurring] = useState(item?.isRecurring || false);

  const { register, handleSubmit, watch, setValue } = useForm<PaymentItem>({
    defaultValues: item || {
      dueDate: new Date().toISOString().split('T')[0],
      title: "",
      description: null,
      amount: "",
      currency: "RUB",
      category: "payable",
      counterparty: null,
      status: "pending",
      isRecurring: false,
      notes: null,
    },
  });

  const category = watch("category");
  const status = watch("status");

  const createMutation = useMutation({
    mutationFn: async (data: PaymentItem) => {
      const response = await fetch("/api/payment-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, isRecurring, userId: user?.id, action: "create" }),
      });
      if (!response.ok) throw new Error("Ошибка при создании платежа");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar/upcoming"] });
      toast({
        title: "Успешно",
        description: "Платеж создан",
      });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PaymentItem) => {
      const response = await fetch(`/api/payment-calendar/${item?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, isRecurring, userId: user?.id, action: "update" }),
      });
      if (!response.ok) throw new Error("Ошибка при обновлении платежа");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-calendar/upcoming"] });
      toast({
        title: "Успешно",
        description: "Платеж обновлен",
      });
      onOpenChange(false);
    },
  });

  const onSubmit = (data: PaymentItem) => {
    if (item?.id) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item?.id ? "Редактировать платеж" : "Добавить платеж"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Дата платежа</Label>
              <Input
                id="dueDate"
                type="date"
                {...register("dueDate", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория</Label>
              <Select
                value={category}
                onValueChange={(value) => setValue("category", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payable">К оплате</SelectItem>
                  <SelectItem value="receivable">К получению</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              {...register("title", { required: true })}
              placeholder="Например: Оплата поставщику"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...register("amount", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="counterparty">Контрагент</Label>
              <Input id="counterparty" {...register("counterparty")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Статус</Label>
            <Select
              value={status}
              onValueChange={(value) => setValue("status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Ожидает оплаты</SelectItem>
                <SelectItem value="paid">Оплачено</SelectItem>
                <SelectItem value="overdue">Просрочено</SelectItem>
                <SelectItem value="cancelled">Отменено</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" {...register("description")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Примечания</Label>
            <Textarea id="notes" {...register("notes")} />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
            <Label htmlFor="isRecurring">Регулярный платеж</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              {item?.id ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}