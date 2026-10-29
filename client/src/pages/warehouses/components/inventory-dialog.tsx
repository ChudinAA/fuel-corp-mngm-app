import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  MinimizableDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  MinimizableDialogContent,
} from "@/components/ui/dialog";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
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
import { PRODUCT_TYPE } from "@shared/constants";
import {
  formatPricePerTonne,
  formatTonnes,
} from "@shared/units";
import type { WarehouseWithTonnes } from "../types";

const inventorySchema = z.object({
  productType: z.string().min(1, "Выберите тип продукта"),
  targetDate: z.string().min(1, "Укажите дату"),
  targetBalanceTonnes: z
    .string()
    .min(1, "Укажите целевой остаток")
    .refine(
      (v) => /^\d+(?:\.\d{1,5})?$/.test(v) && Number.isFinite(Number(v)),
      "Введите массу с точностью до 5 знаков после запятой",
    ),
  targetAverageCostPerTonne: z
    .string()
    .min(1, "Укажите целевую себестоимость")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Некорректное значение"),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

interface InventoryDialogProps {
  warehouse: WarehouseWithTonnes;
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
      targetBalanceTonnes: "",
      targetAverageCostPerTonne: "",
    },
  });

  const watchDate = form.watch("targetDate");
  const watchProductType = form.watch("productType");

  const { data: balanceAtDate, isFetching: isLoadingBalance } = useQuery<{
    balanceTonnes: string;
    averageCostPerTonne: string;
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

  const currentBalanceTonnes = Number(balanceAtDate?.balanceTonnes ?? 0);
  const currentCostPerTonne = Number(
    balanceAtDate?.averageCostPerTonne ?? 0,
  );

  const watchTargetBalance = form.watch("targetBalanceTonnes");
  const watchTargetCost = form.watch("targetAverageCostPerTonne");

  const targetBalanceTonnes = parseFloat(watchTargetBalance || "0");
  const deltaTonnes = targetBalanceTonnes - currentBalanceTonnes;

  const mutation = useMutation({
    mutationFn: async (data: InventoryFormValues) => {
      const payload = {
        ...data,
        targetBalanceTonnes: Number(data.targetBalanceTonnes).toFixed(5),
        targetAverageCostPerTonne: String(
          Number(data.targetAverageCostPerTonne),
        ),
      };
      const res = await apiRequest("POST", `/api/warehouses/${warehouse.id}/inventory`, payload);
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
        targetBalanceTonnes: "",
        targetAverageCostPerTonne: "",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({
    title: `Инвентаризация — ${warehouse.name}`,
    onClose: () => onOpenChange(false),
  });

  return (
    <>
      {MinimizedBar}
      <MinimizableDialog isMinimized={isMinimized} open={open} onOpenChange={onOpenChange}>
        <MinimizableDialogContent isMinimized={isMinimized} className="max-w-md">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Инвентаризация — {warehouse.name}
              </DialogTitle>
              <div className="shrink-0 mt-[-4px]">{MinimizeButton}</div>
            </div>
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
                        <p className="font-semibold">{formatTonnes(currentBalanceTonnes)} т</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Себестоимость:</span>
                        <p className="font-semibold">{formatPricePerTonne(currentCostPerTonne)} ₽/т</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <FormField
                control={form.control}
                name="targetBalanceTonnes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевой остаток (т)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.00001"
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
                name="targetAverageCostPerTonne"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевая себестоимость (₽/т)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
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
                      className={`font-semibold text-sm ${deltaTonnes > 0 ? "text-green-600" : deltaTonnes < 0 ? "text-red-600" : "text-muted-foreground"}`}
                    >
                      {deltaTonnes > 0 ? "+" : ""}
                      {formatTonnes(deltaTonnes)} т
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Тип транзакции:</span>
                    <span className="font-medium text-xs">
                      {deltaTonnes === 0 ? "Коррекция себестоимости" : deltaTonnes > 0 ? "Приход (инв.)" : "Расход (инв.)"}
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
        </MinimizableDialogContent>
      </MinimizableDialog>
      <ErrorModalComponent />
    </>
  );
}
