import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardList } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import type { Warehouse } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import { formatNumber, formatCost } from "../utils";

const inventorySchema = z.object({
  productType: z.string().min(1, "Выберите тип продукта"),
  targetDate: z.string().min(1, "Укажите дату"),
  targetBalance: z
    .string()
    .min(1, "Укажите целевой остаток")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Некорректное значение"),
  targetAverageCost: z
    .string()
    .min(1, "Укажите целевую себестоимость")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Некорректное значение"),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

interface InventoryDialogProps {
  warehouse: Warehouse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryDialog({ warehouse, open, onOpenChange }: InventoryDialogProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      productType: PRODUCT_TYPE.KEROSENE,
      targetDate: new Date().toISOString().slice(0, 10),
      targetBalance: "",
      targetAverageCost: "",
    },
  });

  const watchDate = form.watch("targetDate");
  const watchProductType = form.watch("productType");

  const { data: balanceAtDate, isFetching: isLoadingBalance } = useQuery<{
    balance: string;
    averageCost: string;
  }>({
    queryKey: [
      `/api/warehouses/${warehouse.id}/balance`,
      watchDate,
      watchProductType,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/warehouses/${warehouse.id}/balance?date=${watchDate}&productType=${watchProductType}`,
      );
      if (!res.ok) throw new Error("Failed to fetch balance");
      return res.json();
    },
    enabled: open && !!watchDate && !!watchProductType,
  });

  const currentBalance = parseFloat(balanceAtDate?.balance || "0");
  const currentCost = parseFloat(balanceAtDate?.averageCost || "0");

  const watchTargetBalance = form.watch("targetBalance");
  const watchTargetCost = form.watch("targetAverageCost");

  const targetBalance = parseFloat(watchTargetBalance || "0");
  const targetCost = parseFloat(watchTargetCost || "0");
  const delta = targetBalance - currentBalance;

  const mutation = useMutation({
    mutationFn: async (data: InventoryFormValues) => {
      const res = await apiRequest("POST", `/api/warehouses/${warehouse.id}/inventory`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка инвентаризации");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
      });
      toast({
        title: "Инвентаризация выполнена",
        description: "Транзакция инвентаризации добавлена в историю склада",
      });
      form.reset({
        productType: PRODUCT_TYPE.KEROSENE,
        targetDate: new Date().toISOString().slice(0, 10),
        targetBalance: "",
        targetAverageCost: "",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Инвентаризация — {warehouse.name}
            </DialogTitle>
            <DialogDescription>
              Установите целевые показатели на выбранную дату. Система автоматически рассчитает и добавит корректирующую транзакцию.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип продукта</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-inventory-product-type">
                            <SelectValue placeholder="Выберите" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PRODUCT_TYPE.KEROSENE}>Керосин</SelectItem>
                          <SelectItem value={PRODUCT_TYPE.PVKJ}>ПВКЖ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          data-testid="input-inventory-date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Current state at date */}
              {watchDate && (
                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">
                    Текущие показатели на {watchDate}
                  </p>
                  {isLoadingBalance ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Загрузка...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground text-xs">Остаток:</span>
                        <p className="font-semibold">{formatNumber(currentBalance)} кг</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Себестоимость:</span>
                        <p className="font-semibold">{formatCost(currentCost)}/кг</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="targetBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевой остаток (кг)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Желаемый остаток на дату"
                        data-testid="input-inventory-target-balance"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetAverageCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевая себестоимость (₽/кг)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.000001"
                        placeholder="Желаемая себестоимость на дату"
                        data-testid="input-inventory-target-cost"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {watchTargetBalance && watchTargetCost && !isLoadingBalance && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Корректирующая транзакция
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Изменение остатка:</span>
                    <span
                      className={`font-semibold text-sm ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"}`}
                    >
                      {delta > 0 ? "+" : ""}
                      {formatNumber(delta)} кг
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Тип транзакции:</span>
                    <span className="font-medium text-xs">
                      {delta === 0 ? "Коррекция себестоимости" : delta > 0 ? "Приход (инв.)" : "Расход (инв.)"}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-submit-inventory"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Выполнение...
                    </>
                  ) : (
                    "Провести инвентаризацию"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ErrorModalComponent />
    </>
  );
}
