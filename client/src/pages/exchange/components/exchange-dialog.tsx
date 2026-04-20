
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRODUCT_TYPE } from "@shared/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { exchangeFormSchema, type ExchangeFormData } from "../schemas";
import type { ExchangeDialogProps } from "../types";
import { formatCurrency } from "../utils";

const PRODUCT_TYPE_OPTIONS = [
  { value: PRODUCT_TYPE.KEROSENE, label: "Керосин" },
  { value: PRODUCT_TYPE.PVKJ, label: "ПВКЖ" },
];

export function ExchangeDialog({
  warehouses,
  supplierWarehouses,
  editExchange,
  open,
  onOpenChange,
}: ExchangeDialogProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const isEditing = !!editExchange;

  const form = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      dealDate: editExchange?.dealDate ? new Date(editExchange.dealDate) : new Date(),
      dealNumber: editExchange?.dealNumber || "",
      counterparty: editExchange?.counterparty || "",
      productType: editExchange?.productType || PRODUCT_TYPE.KEROSENE,
      quantityKg: editExchange?.quantityKg?.toString() || "",
      pricePerKg: editExchange?.pricePerKg?.toString() || "",
      warehouseId: editExchange?.warehouseId || "",
      notes: editExchange?.notes || "",
      buyerSupplierId: editExchange?.buyerSupplierId || null,
      isReceivedAtWarehouse: editExchange?.isReceivedAtWarehouse ?? false,
    },
  });

  const watchBuyerSupplierId = form.watch("buyerSupplierId");
  const watchQuantity = form.watch("quantityKg");
  const watchPrice = form.watch("pricePerKg");

  const totalAmount =
    watchQuantity && watchPrice
      ? parseFloat(watchQuantity) * parseFloat(watchPrice)
      : 0;

  // Опции покупателя: внешние контрагенты из свободного ввода + наши поставщики-склады
  const buyerOptions = supplierWarehouses.map((s) => ({
    value: `supplier:${s.id}`,
    label: `[Склад] ${s.name}`,
  }));

  // Определяем текущее значение для Combobox покупателя
  const getBuyerComboboxValue = () => {
    const supplierId = form.watch("buyerSupplierId");
    if (supplierId) return `supplier:${supplierId}`;
    return form.watch("counterparty") || "";
  };

  const handleBuyerChange = (value: string) => {
    if (value.startsWith("supplier:")) {
      const supplierId = value.replace("supplier:", "");
      const supplier = supplierWarehouses.find((s) => s.id === supplierId);
      form.setValue("buyerSupplierId", supplierId, { shouldValidate: true });
      form.setValue("counterparty", supplier?.name || "", { shouldValidate: true });
      // При смене покупателя сбрасываем чекбокс получения
      form.setValue("isReceivedAtWarehouse", false);
    } else {
      form.setValue("buyerSupplierId", null, { shouldValidate: true });
      form.setValue("counterparty", value, { shouldValidate: true });
      form.setValue("isReceivedAtWarehouse", false);
    }
  };

  // Опции складов
  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: w.name,
  }));

  const createMutation = useMutation({
    mutationFn: async (data: ExchangeFormData) => {
      const quantity = parseFloat(data.quantityKg);
      const price = parseFloat(data.pricePerKg);
      const payload = {
        ...data,
        dealDate: format(data.dealDate, "yyyy-MM-dd'T'HH:mm:ss"),
        warehouseId: data.warehouseId || null,
        buyerSupplierId: data.buyerSupplierId || null,
        totalAmount: (quantity * price).toString(),
      };
      const res = await apiRequest(
        isEditing ? "PUT" : "POST",
        isEditing ? `/api/exchange/${editExchange?.id}` : "/api/exchange",
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: isEditing ? "Сделка обновлена" : "Сделка создана",
        description: isEditing
          ? "Биржевая сделка успешно обновлена"
          : "Биржевая сделка успешно сохранена",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error);
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? "Редактирование биржевой сделки"
                : "Новая биржевая сделка"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Измените данные для обновления сделки"
                : "Заполните данные для записи сделки"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                createMutation.mutate(data),
              )}
              className="space-y-6"
            >
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="dealDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата сделки</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              data-testid="input-exchange-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(field.value, "dd.MM.yyyy", {
                                    locale: ru,
                                  })
                                : "Выберите дату"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            locale={ru}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dealNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер сделки</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="СПБ-001234"
                          data-testid="input-exchange-number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Покупатель — внешний контрагент или наш поставщик-склад */}
                <FormField
                  control={form.control}
                  name="counterparty"
                  render={() => (
                    <FormItem>
                      <FormLabel>Покупатель</FormLabel>
                      <FormControl>
                        <Combobox
                          options={buyerOptions}
                          value={getBuyerComboboxValue()}
                          onValueChange={handleBuyerChange}
                          placeholder="Контрагент или наш склад"
                          emptyMessage="Нет совпадений"
                          allowCustomValue
                          dataTestId="combobox-exchange-buyer"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип продукта</FormLabel>
                      <FormControl>
                        <Combobox
                          options={PRODUCT_TYPE_OPTIONS}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Выберите тип"
                          emptyMessage="Нет данных"
                          dataTestId="combobox-exchange-product"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="quantityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Количество (КГ)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          data-testid="input-exchange-quantity"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricePerKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Цена за кг (₽)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-exchange-price"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Сумма сделки</label>
                  <div className="h-10 px-3 bg-muted rounded-md flex items-center">
                    <span className="text-sm font-medium">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Склад назначения</FormLabel>
                      <FormControl>
                        <Combobox
                          options={warehouseOptions}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Выберите склад"
                          emptyMessage="Нет данных"
                          dataTestId="combobox-exchange-warehouse"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Примечания</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Дополнительная информация..."
                        className="resize-none"
                        data-testid="input-exchange-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Чекбокс подтверждения получения — только если выбран наш склад */}
              {watchBuyerSupplierId && (
                <FormField
                  control={form.control}
                  name="isReceivedAtWarehouse"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-exchange-received"
                        />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="cursor-pointer text-sm font-medium">
                          Подтвердить получение на складе
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Вагоны с топливом прибыли на склад. После сохранения
                          будет проведена транзакция пополнения склада и создана
                          запись в Перемещениях.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-create-exchange"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? "Обновление..." : "Сохранение..."}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {isEditing ? "Обновить сделку" : "Создать сделку"}
                    </>
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
