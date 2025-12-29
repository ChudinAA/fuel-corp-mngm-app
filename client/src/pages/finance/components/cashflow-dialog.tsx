
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface CashflowTransaction {
  id?: string;
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

interface CashflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: CashflowTransaction;
}

export function CashflowDialog({ open, onOpenChange, transaction }: CashflowDialogProps) {
  const { toast } = useToast();
  const [isPlanned, setIsPlanned] = useState(transaction?.isPlanned || false);

  const { register, handleSubmit, watch, setValue } = useForm<CashflowTransaction>({
    defaultValues: transaction || {
      transactionDate: new Date().toISOString().split('T')[0],
      category: "income",
      subcategory: null,
      amount: "",
      currency: "RUB",
      description: null,
      counterparty: null,
      paymentMethod: "bank_transfer",
      isPlanned: false,
      notes: null,
    },
  });

  const category = watch("category");

  const createMutation = useMutation({
    mutationFn: async (data: CashflowTransaction) => {
      const response = await fetch("/api/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, isPlanned }),
      });
      if (!response.ok) throw new Error("Ошибка при создании транзакции");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/summary"] });
      toast({
        title: "Успешно",
        description: "Транзакция создана",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать транзакцию",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CashflowTransaction) => {
      const response = await fetch(`/api/cashflow/${transaction?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, isPlanned }),
      });
      if (!response.ok) throw new Error("Ошибка при обновлении транзакции");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/summary"] });
      toast({
        title: "Успешно",
        description: "Транзакция обновлена",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить транзакцию",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CashflowTransaction) => {
    if (transaction?.id) {
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
            {transaction?.id ? "Редактировать транзакцию" : "Добавить транзакцию"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transactionDate">Дата</Label>
              <Input
                id="transactionDate"
                type="date"
                {...register("transactionDate", { required: true })}
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
                  <SelectItem value="income">Поступление</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                  <SelectItem value="transfer">Перемещение</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory">Подкатегория</Label>
              <Input id="subcategory" {...register("subcategory")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Способ оплаты</Label>
              <Select
                defaultValue={transaction?.paymentMethod || "bank_transfer"}
                onValueChange={(value) => setValue("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="bank_transfer">Банковский перевод</SelectItem>
                  <SelectItem value="card">Карта</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Input id="description" {...register("description")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Примечания</Label>
            <Textarea id="notes" {...register("notes")} />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isPlanned"
              checked={isPlanned}
              onCheckedChange={setIsPlanned}
            />
            <Label htmlFor="isPlanned">Планируемая транзакция</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit">
              {transaction?.id ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
