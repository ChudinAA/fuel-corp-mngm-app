import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Loader2, Gauge } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import type { Warehouse } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import { format, addMonths, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";

const limitSchema = z.object({
  limitVolume: z
    .string()
    .min(1, "Укажите объём лимита")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Лимит должен быть > 0"),
  limitProductType: z.string().min(1, "Выберите тип продукта"),
});

type LimitFormValues = z.infer<typeof limitSchema>;

interface SetLimitDialogProps {
  warehouse: Warehouse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetLimitDialog({ warehouse, open, onOpenChange }: SetLimitDialogProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();

  const nextMonthFirst = format(
    startOfMonth(addMonths(new Date(), 1)),
    "d MMMM yyyy",
    { locale: ru },
  );

  const form = useForm<LimitFormValues>({
    resolver: zodResolver(limitSchema),
    defaultValues: {
      limitVolume: warehouse.limitVolume ? String(warehouse.limitVolume) : "",
      limitProductType: warehouse.limitProductType || PRODUCT_TYPE.KEROSENE,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LimitFormValues) => {
      const res = await apiRequest("POST", `/api/warehouses/${warehouse.id}/set-limit`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка установки лимита");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: "Лимит установлен",
        description: `Лимит будет действовать до ${nextMonthFirst}`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  const removeLimitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/warehouses/${warehouse.id}/set-limit`, {
        limitVolume: null,
        limitProductType: null,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка снятия лимита");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Лимит снят" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({
    title: `Лимит склада — ${warehouse.name}`,
    onClose: () => onOpenChange(false),
  });

  if (isMinimized) return <>{MinimizedBar}</>;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Лимит склада — {warehouse.name}
              </DialogTitle>
              <div className="shrink-0 mt-[-4px]">{MinimizeButton}</div>
            </div>
            <DialogDescription>
              Лимит будет сброшен {nextMonthFirst} (1-е следующего месяца)
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="limitProductType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип топлива</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-limit-product-type">
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
                name="limitVolume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Объём лимита (кг)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Максимальный объём в кг"
                        data-testid="input-limit-volume"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between gap-3 pt-2">
                <div>
                  {warehouse.limitVolume && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeLimitMutation.mutate()}
                      disabled={removeLimitMutation.isPending}
                      data-testid="button-remove-limit"
                    >
                      {removeLimitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Снять лимит"
                      )}
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    data-testid="button-save-limit"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      "Установить"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ErrorModalComponent />
    </>
  );
}
