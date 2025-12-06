
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { exchangeFormSchema, type ExchangeFormData } from "../schemas";
import type { ExchangeDialogProps } from "../types";
import { formatCurrency } from "../utils";

export function ExchangeDialog({ 
  warehouses, 
  editExchange, 
  open, 
  onOpenChange 
}: ExchangeDialogProps) {
  const { toast } = useToast();
  const isEditing = !!editExchange;

  const form = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      dealDate: editExchange?.dealDate ? new Date(editExchange.dealDate) : new Date(),
      dealNumber: editExchange?.dealNumber || "",
      counterparty: editExchange?.counterparty || "",
      productType: editExchange?.productType || "kerosene",
      quantityKg: editExchange?.quantityKg?.toString() || "",
      pricePerKg: editExchange?.pricePerKg?.toString() || "",
      warehouseId: editExchange?.warehouseId || "",
      notes: editExchange?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExchangeFormData) => {
      const quantity = parseFloat(data.quantityKg);
      const price = parseFloat(data.pricePerKg);
      const payload = {
        ...data,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        warehouseId: data.warehouseId || null,
        totalAmount: (quantity * price).toString(),
      };
      const res = await apiRequest(
        isEditing ? "PATCH" : "POST", 
        isEditing ? `/api/exchange/${editExchange?.id}` : "/api/exchange", 
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      toast({ 
        title: isEditing ? "Сделка обновлена" : "Сделка создана", 
        description: isEditing ? "Биржевая сделка успешно обновлена" : "Биржевая сделка успешно сохранена" 
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const watchQuantity = form.watch("quantityKg");
  const watchPrice = form.watch("pricePerKg");

  const totalAmount = watchQuantity && watchPrice
    ? parseFloat(watchQuantity) * parseFloat(watchPrice)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование биржевой сделки" : "Новая биржевая сделка"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Измените данные для обновления сделки" : "Заполните данные для записи сделки"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
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
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-exchange-date">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ru} />
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
                      <Input placeholder="СПБ-001234" data-testid="input-exchange-number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контрагент</FormLabel>
                    <FormControl>
                      <Input placeholder="Название контрагента" data-testid="input-exchange-counterparty" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exchange-product">
                          <SelectValue placeholder="Выберите тип" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kerosene">Керосин</SelectItem>
                        <SelectItem value="pvkj">ПВКЖ</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Input type="number" placeholder="0.00" data-testid="input-exchange-quantity" {...field} />
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
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-exchange-price" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1">
                <label className="text-sm font-medium">Сумма сделки</label>
                <div className="h-10 px-3 bg-muted rounded-md flex items-center">
                  <span className="text-sm font-medium">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Склад назначения</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exchange-warehouse">
                          <SelectValue placeholder="Выберите склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses?.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
                          </SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
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
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-exchange-notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-exchange">
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Обновить сделку" : "Создать сделку"}</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
